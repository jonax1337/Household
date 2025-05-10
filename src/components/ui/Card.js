import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

// Definiere eine Zwischenkomponente, um DOM-Props zu filtern
const MotionDiv = ({ noPadding, fullWidth, bordered, ...rest }) => <motion.div {...rest} />;

const CardContainer = styled(MotionDiv)`
  background-color: ${({ theme }) => theme.cardBackground};
  border-radius: ${({ theme }) => theme.cardRadius};
  box-shadow: ${({ theme }) => theme.shadow};
  padding: ${({ noPadding }) => (noPadding ? '0' : '16px')};
  margin-bottom: 16px;
  overflow: hidden;
  width: ${({ fullWidth }) => (fullWidth ? '100%' : 'auto')};
  border: ${({ bordered, theme }) => bordered ? `1px solid ${theme.border}` : 'none'};
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ noMargin }) => (noMargin ? '0' : '12px')};
  padding: ${({ noPadding }) => (noPadding ? '0' : '0 0 12px 0')};
  border-bottom: ${({ divider, theme }) => divider ? `1px solid ${theme.border}` : 'none'};
`;

const CardTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: ${({ theme }) => theme.text};
  font-family: 'Roboto Condensed', -apple-system, BlinkMacSystemFont, sans-serif;
`;

const CardContent = styled.div`
  color: ${({ theme }) => theme.text};
`;

const CardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: ${({ align }) => align || 'flex-end'};
  margin-top: ${({ noMargin }) => (noMargin ? '0' : '12px')};
  padding: ${({ noPadding }) => (noPadding ? '0' : '12px 0 0 0')};
  border-top: ${({ divider, theme }) => divider ? `1px solid ${theme.border}` : 'none'};
`;

const Card = ({
  children,
  title,
  headerRight,
  footer,
  footerAlign,
  noPadding = false,
  fullWidth = false,
  bordered = false,
  divider = false,
  ...props
}) => {
  return (
    <CardContainer 
      noPadding={noPadding}
      fullWidth={fullWidth}
      bordered={bordered}
      {...props}
    >
      {(title || headerRight) && (
        <CardHeader divider={divider} noPadding={noPadding}>
          {title && <CardTitle>{title}</CardTitle>}
          {headerRight}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
      {footer && (
        <CardFooter divider={divider} align={footerAlign} noPadding={noPadding}>
          {footer}
        </CardFooter>
      )}
    </CardContainer>
  );
};

export default Card;
