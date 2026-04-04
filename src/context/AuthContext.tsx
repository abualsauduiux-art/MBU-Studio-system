import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDocs, collection, query, where, deleteDoc } from 'firebase/firestore';
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
            const q = query(collection(db, 'users'), where('email', '==', firebaseUser.email));
            const manualSnap = await getDocs(q);
            const manualDoc = manualSnap.docs.find(d => d.id.startsWith('manual_'));

            let initialRole = firebaseUser.email === 'abualsaud.uiux@gmail.com' ? 'admin' : 'employee';
            let initialJobTitle = '';
            let initialName = firebaseUser.displayName || 'مستخدم جديد';

            if (manualDoc) {
              const manualData = manualDoc.data();
              initialRole = manualData.role || initialRole;
              initialJobTitle = manualData.jobTitle || '';
              initialName = manualData.name || initialName;
              // Delete the manual doc to avoid confusion
              deleteDoc(manualDoc.ref).catch(err => console.error("Error deleting manual doc:", err));
            }

            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              name: initialName,
              email: firebaseUser.email || '',
              role: initialRole as any,
              jobTitle: initialJobTitle,
              photoURL: firebaseUser.photoURL || undefined,
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
            setDoc(profileRef, newProfile).catch(err => handleFirestoreError(err, OperationType.WRITE, 'users'));
          }
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, 'users');
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

  const hasPermission = (permission: keyof import('../types').UserPermissions) => {
    if (profile?.role === 'admin') return true;
    return profile?.permissions?.[permission] ?? false;
  };

  const value: AuthContextType = {
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    isManager: profile?.role === 'admin' || profile?.role === 'manager',
    hasPermission,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
