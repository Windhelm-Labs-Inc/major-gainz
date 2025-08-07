import React from 'react';
import styles from './sidebar.module.css';
// Vite static asset import to ensure URL rewriting
import logo from '../../assets/major_gainz_lettering.svg?url';

interface VerticalSidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

const VerticalSidebar: React.FC<VerticalSidebarProps> = ({ 
  isOpen = false, 
  onToggle 
}) => {
  const sidebarClass = [
    styles.sidebar,
    isOpen ? styles.mobileOpen : ''
  ].filter(Boolean).join(' ');

  const handleClick = () => {
    // On mobile, clicking the sidebar closes it
    if (window.innerWidth <= 768 && onToggle) {
      onToggle();
    }
  };

  return (
    <aside 
      className={sidebarClass}
      onClick={handleClick}
      role="banner"
      aria-label="Major Gainz branding sidebar"
    >
      <div className={styles.logoContainer}>
        <img src={logo} alt="Major Gainz" className={styles.logo} loading="eager" />
      </div>
    </aside>
  );
};

export default VerticalSidebar;
