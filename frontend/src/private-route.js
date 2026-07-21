import React from 'react';
import { checkSession } from './authentication/cookie'; // Fixed path
import Login from './authentication/login';

const PrivateRoute = ({ component: Component }) => {
  const isAuthenticated = checkSession() !== null;
  
  return isAuthenticated ? <Component /> : <Login />;
};

export default PrivateRoute;