import LoginState from '../authentication/loginState';
import CommonUtilityController from '../master/controller/common-utility-controller';

class TourManager {
  /**
   * Get current tour status
   * Priority: 1. Cookie (persisted), 2. LoginState (may be stale on refresh), 3. Default to 0
   */
  static async getStatus() {
    try {
      const cookies = document.cookie.split(';');
      const tourCookie = cookies.find(c => c.trim().startsWith('TourStatus='));

      if (tourCookie) {
        const status = parseInt(tourCookie.split('=')[1]);
        return status;
      }

      const user = LoginState.getUser ? LoginState.getUser() : LoginState;
      if (user && user.TourStatus !== undefined && user.TourStatus !== null) {
        return user.TourStatus;
      }

      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Complete the tour - Updates BOTH database AND cookie
   * @param {number} code - Tour status code (1=Completed, 2=Skipped)
   * @returns {Promise<object>} Response object with success status
   */
  static async complete(code) {
    try {
      const user = LoginState.getUser ? LoginState.getUser() : LoginState;

      if (!user || !user.UserId) {
        const expires = new Date();
        expires.setDate(expires.getDate() + 365);
        document.cookie = `TourStatus=${code}; expires=${expires.toUTCString()}; path=/`;
        return { success: false, error: 'No user found' };
      }

      // Update cookie IMMEDIATELY (before API call)
      const expires = new Date();
      expires.setDate(expires.getDate() + 365);
      document.cookie = `TourStatus=${code}; expires=${expires.toUTCString()}; path=/`;

      // Call API to update database
      const controller = new CommonUtilityController();
      const response = await controller.updateTourStatus({
        UserId: user.UserId,
        TourStatus: code
      });

      if (response && response.success) {
        // Update LoginState
        if (LoginState.setUser) {
          const updatedUser = { ...user, TourStatus: code };
          LoginState.setUser(updatedUser);
        } else {
          LoginState.TourStatus = code;
        }

        return { success: true, tourStatus: code };
      } else {
        return { success: false, error: 'API call failed', response };
      }
    } catch (error) {
      return { success: false, error: error.message || 'Unknown error' };
    }
  }

  /**
   * Check if tour can run
   * Returns true only if TourStatus is 0 (Pending)
   * @returns {boolean}
   */
  static canRun() {
    try {
      const cookies = document.cookie.split(';');
      const tourCookie = cookies.find(c => c.trim().startsWith('TourStatus='));

      if (tourCookie) {
        const status = parseInt(tourCookie.split('=')[1]);
        return status === 0;
      }

      const user = LoginState.getUser ? LoginState.getUser() : LoginState;

      if (user && user.TourStatus !== undefined && user.TourStatus !== null) {
        return user.TourStatus === 0;
      }

      return true;
    } catch (error) {
      return true;
    }
  }
}

export default TourManager;