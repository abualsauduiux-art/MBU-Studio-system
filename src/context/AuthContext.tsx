import React, { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, deleteDoc, collection, getDocs, limit, query } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  hasPermission: (permission: keyof import('../types').UserPermissions) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isManager: false,
  hasPermission: () => false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        const profileRef = doc(db, 'users', firebaseUser.uid);
        
        const unsubProfile = onSnapshot(profileRef, async (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
            setLoading(false);
          } else {
            // Check if there's a manual profile with this email
            const manualId = `manual_${firebaseUser.email?.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const manualRef = doc(db, 'users', manualId);
            
            let manualData: any = null;
            try {
              const manualSnap = await getDoc(manualRef);
              if (manualSnap.exists()) {
                manualData = manualSnap.data();
                // Delete the manual doc to avoid confusion
                await deleteDoc(manualRef);
              }
            } catch (err) {
              console.error("Error checking/deleting manual doc:", err);
            }

            let initialRole = firebaseUser.email === 'abualsaud.uiux@gmail.com' ? 'admin' : 'employee';
            
            // If the users collection is empty, the first user becomes admin
            try {
              const usersSnap = await getDocs(query(collection(db, 'users'), limit(1)));
              if (usersSnap.empty) {
                initialRole = 'admin';
              }
            } catch (err) {
              console.error("Error checking for existing users:", err);
            }

            let initialJobTitle = '';
            let initialName = firebaseUser.displayName || 'مستخدم جديد';

            if (manualData) {
              initialRole = manualData.role || initialRole;
              initialJobTitle = manualData.jobTitle || '';
              initialName = manualData.name || initialName;
            }

            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              name: initialName,
              email: firebaseUser.email || '',
              role: initialRole as any,
              jobTitle: initialJobTitle,
              photoURL: firebaseUser.photoURL || null, // Use null instead of undefined
              createdAt: new Date().toISOString(),
              permissions: {
                dashboard: true,
                clients: true,
                projects: true,
                tasks: true,
                messages: true,
                financials: initialRole === 'admin' || initialRole === 'manager',
                team: initialRole === 'admin' || initialRole === 'manager',
                settings: initialRole === 'admin',
              }
            };
            try {
              await setDoc(profileRef, newProfile);
            } catch (err) {
              console.error("Error creating profile:", err);
            }
          }
        }, (err) => {
          console.error("Profile snapshot error:", err);
          setLoading(false);
        });

        return () => unsubProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const hasPermission = useCallback((permission: keyof import('../types').UserPermissions) => {
    if (profile?.role === 'admin') return true;
    return profile?.permissions?.[permission] ?? false;
  }, [profile]);

  const value: AuthContextType = useMemo(() => ({
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    isManager: profile?.role === 'admin' || profile?.role === 'manager',
    hasPermission,
  }), [user, profile, loading, hasPermission]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
