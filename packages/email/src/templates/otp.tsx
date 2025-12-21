import * as React from 'react';

interface OtpEmailProps {
    otp: string;
}

export const OtpEmail: React.FC<OtpEmailProps> = ({ otp }) => (
    <div style={{ fontFamily: 'sans-serif', lineHeight: 1.5 }}>
        <h1>Verify your email</h1>
        <p>Your verification code is:</p>
        <div style={{
            padding: '12px 24px',
            backgroundColor: '#f4f4f5',
            borderRadius: '8px',
            fontSize: '24px',
            fontWeight: 'bold',
            letterSpacing: '4px',
            display: 'inline-block',
            margin: '16px 0'
        }}>
            {otp}
        </div>
        <p>This code will expire in 5 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
    </div>
);
