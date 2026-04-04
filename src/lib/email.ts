interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export const sendEmailNotification = async (options: EmailOptions) => {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to send email');
    }
    return data;
  } catch (error) {
    console.error('Error in sendEmailNotification:', error);
    // We don't want to crash the app if email fails
    return { success: false, error };
  }
};
