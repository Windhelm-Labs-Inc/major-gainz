import React from 'react';
import styles from './chat.module.css';
// Import avatar gif for correct asset path
import avatarGif from '../../assets/major_gainz_transparent.gif?url';

interface AvatarProps {
  sender: 'user' | 'agent' | 'system';
  className?: string;
  rankIconUrl?: string; // used when sender is 'user'
}

const Avatar: React.FC<AvatarProps> = ({ sender, className, rankIconUrl }) => {
  const avatarClass = [styles.avatar, className].filter(Boolean).join(' ');

  if (sender === 'agent') {
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
  }

  if (sender === 'user' && rankIconUrl) {
    return (
      <div className={avatarClass} aria-label="User rank insignia">
        <img
          src={rankIconUrl}
          alt="User Rank"
          className={styles.userRankImage}
          loading="lazy"
        />
      </div>
    );
  }

  return null;
};

export default Avatar;
