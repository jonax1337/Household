import React from 'react';
import styled, { css } from 'styled-components';
import { motion } from 'framer-motion';

// Definiere eine Zwischenkomponente, um DOM-Props zu filtern
const MotionButton = ({ fullWidth, rounded, ...rest }) => <motion.button {...rest} />;

const ButtonBase = styled(MotionButton)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme, rounded }) => rounded ? '50px' : theme.buttonRadius};
  padding: 12px 20px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  outline: none;
  position: relative;
  overflow: hidden;
  font-family: 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
  gap: 8px;
  user-select: none;
  width: ${({ fullWidth }) => (fullWidth ? '100%' : 'auto')};
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  ${({ variant, theme }) =>
    variant === 'primary' &&
    css`
      background-color: ${theme.primary};
      color: white;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      
      &:hover:not(:disabled) {
        background-color: ${theme.name === 'dark' 
          ? 'rgba(10, 132, 255, 0.8)' 
          : theme.name === 'cute' 
            ? 'rgba(255, 106, 193, 0.8)' 
            : 'rgba(0, 122, 255, 0.8)'};
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
      }
      
      &:active:not(:disabled) {
        transform: translateY(0);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      }
    `}

  ${({ variant, theme }) =>
    variant === 'secondary' &&
    css`
      background-color: transparent;
      color: ${theme.primary};
      border: 1.5px solid ${theme.primary};
      
      &:hover:not(:disabled) {
        background-color: ${theme.name === 'dark' 
          ? 'rgba(10, 132, 255, 0.1)' 
          : theme.name === 'cute' 
            ? 'rgba(255, 106, 193, 0.1)' 
            : 'rgba(0, 122, 255, 0.1)'};
      }
      
      &:active:not(:disabled) {
        background-color: ${theme.name === 'dark' 
          ? 'rgba(10, 132, 255, 0.2)' 
          : theme.name === 'cute' 
            ? 'rgba(255, 106, 193, 0.2)' 
            : 'rgba(0, 122, 255, 0.2)'};
      }
    `}

  ${({ variant, theme }) =>
    variant === 'text' &&
    css`
      background-color: transparent;
      color: ${theme.primary};
      padding: 8px 12px;
      
      &:hover:not(:disabled) {
        background-color: ${theme.name === 'dark' 
          ? 'rgba(10, 132, 255, 0.1)' 
          : theme.name === 'cute' 
            ? 'rgba(255, 106, 193, 0.1)' 
            : 'rgba(0, 122, 255, 0.1)'};
      }
    `}
    
  ${({ variant, theme }) =>
    variant === 'danger' &&
    css`
      background-color: ${theme.error};
      color: white;
      
      &:hover:not(:disabled) {
        background-color: ${theme.name === 'dark' 
          ? 'rgba(255, 69, 58, 0.8)' 
          : theme.name === 'cute' 
            ? 'rgba(255, 143, 173, 0.8)' 
            : 'rgba(255, 59, 48, 0.8)'};
      }
    `}

  ${({ size }) =>
    size === 'small' &&
    css`
      font-size: 14px;
      padding: 8px 16px;
    `}

  ${({ size }) =>
    size === 'large' &&
    css`
      font-size: 18px;
      padding: 14px 24px;
    `}

  ${({ rounded }) =>
    rounded &&
    css`
      border-radius: 50px;
    `}
`;

const IconWrapper = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  
  ${({ position }) => position === 'left' && css`
    margin-right: 8px;
  `}
  
  ${({ position }) => position === 'right' && css`
    margin-left: 8px;
  `}
`;

const Button = ({
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  fullWidth = false,
  rounded = false,
  icon,
  iconPosition = 'left',
  onClick,
  type = 'button',
  ...props
}) => {
  return (
    <ButtonBase
      type={type}
      variant={variant}
      size={size}
      disabled={disabled}
      fullWidth={fullWidth}
      rounded={rounded}
      onClick={onClick}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      {...props}
    >
      {icon && iconPosition === 'left' && <IconWrapper position="left">{icon}</IconWrapper>}
      {children}
      {icon && iconPosition === 'right' && <IconWrapper position="right">{icon}</IconWrapper>}
    </ButtonBase>
  );
};

export default Button;
