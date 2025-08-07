import React from 'react';
import styles from './chat.module.css';
// Import avatar gif for correct asset path
import avatarGif from '../../assets/major_gainz_transparent.gif?url';

interface AvatarProps {
  sender: 'user' | 'agent' | 'system';
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({ sender, className }) => {
  if (sender !== 'agent') {
    return null; // Only agents get avatars in Major Gainz design
  }

  const avatarClass = [styles.avatar, className].filter(Boolean).join(' ');

  return (
    <div className={avatarClass}>
      <img
        src={avatarGif}
        alt="Major Gainz Assistant"
        className={styles.avatarImage}
        loading="lazy"
      />
    </div>
  );
};

export default Avatar;
