import { configureStore } from '@reduxjs/toolkit';
import rootReducer from './redux/reducers';
import thunk from 'redux-thunk';

export const basicReduxStore = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore MSAL-specific actions that contain class instances
        ignoredActions: [
          'AAD_LOGIN_SUCCESS',
          'AAD_ACQUIRED_ID_TOKEN_SUCCESS',
          'AAD_LOGOUT_SUCCESS',
          'AAD_AUTHENTICATED_STATE_CHANGED',
          'AAD_LOGIN_ERROR'
        ],
        ignoredActionPaths: ['payload'],
        ignoredPaths: ['azureAuth' ,"azureReducer.idToken", "azureReducer.accessToken" ,"azureReducer.account"],
      },
    }).concat(thunk),
  devTools: true,
});