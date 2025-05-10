import React, { forwardRef } from 'react';
import styled, { css } from 'styled-components';

// Zwischenkomponente für InputWrapper
const WrapperBase = ({ fullWidth, ...rest }) => <div {...rest} />;

const InputWrapper = styled(WrapperBase)`
  display: flex;
  flex-direction: column;
  margin-bottom: 16px;
  width: ${({ fullWidth }) => (fullWidth ? '100%' : 'auto')};
`;

const InputLabel = styled.label`
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 6px;
  color: ${({ theme }) => theme.textSecondary};
`;

// Zwischenkomponente für Input
const InputBase = ({ error, size, ...rest }) => <input {...rest} />;

const StyledInput = styled(InputBase)`
  font-size: ${({ size }) => size === 'small' ? '14px' : size === 'large' ? '18px' : '16px'};
  padding: ${({ size }) => size === 'small' ? '8px 12px' : size === 'large' ? '14px 18px' : '12px 16px'};
  border-radius: 10px;
  border: 1.5px solid ${({ theme, error }) => error ? theme.error : theme.border};
  background-color: ${({ theme }) => theme.name === 'dark' ? 'rgba(44, 44, 46, 0.8)' : 'rgba(255, 255, 255, 0.8)'};
  color: ${({ theme }) => theme.text};
  transition: all 0.2s ease;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif;
  &:focus {
    border-color: ${({ theme }) => theme.primary};
    box-shadow: 0 0 0 2px ${({ theme }) => `${theme.primary}30`};
  }
  
  &::placeholder {
    color: ${({ theme }) => theme.textSecondary};
    opacity: 0.7;
  }
  
  ${({ error, theme }) =>
    error &&
    css`
      border-color: ${theme.error};
      
      &:focus {
        border-color: ${theme.error};
        box-shadow: 0 0 0 2px ${`${theme.error}30`};
      }
    `}
    
  ${({ size }) =>
    size === 'small' &&
    css`
      font-size: 14px;
      padding: 8px 12px;
    `}

  ${({ size }) =>
    size === 'large' &&
    css`
      font-size: 18px;
      padding: 14px 18px;
    `}
`;

const ErrorMessage = styled.div`
  color: ${({ theme }) => theme.error};
  font-size: 12px;
  margin-top: 4px;
`;

const HelpText = styled.div`
  color: ${({ theme }) => theme.textSecondary};
  font-size: 12px;
  margin-top: 4px;
`;

const Input = forwardRef((
  {
    label,
    error,
    helperText,
    fullWidth = false,
    size = 'medium',
    ...props
  },
  ref
) => {
  return (
    <InputWrapper fullWidth={fullWidth}>
      {label && <InputLabel>{label}</InputLabel>}
      <StyledInput ref={ref} error={!!error} size={size} {...props} />
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {helperText && !error && <HelpText>{helperText}</HelpText>}
    </InputWrapper>
  );
});

export default Input;
