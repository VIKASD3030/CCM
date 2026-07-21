import * as React from 'react';
import { Routes, Route } from 'react-router-dom';

class ExternalDashboard extends React.Component {
  render() {
    const loading = () => <div className="animated fadeIn pt-3 text-center">Loading...</div>;
    const ExternalLayout = React.lazy(() => import('./containers/default-layout'));
    return (
      <React.Suspense fallback={loading()}>
        <Routes>
          {/* <Route path="/" element={<ExternalLayout />} /> */}
          {/* If you want to handle subroutes */}
          <Route path="*" element={<ExternalLayout />} />
        </Routes>
      </React.Suspense>
    );
  }
}

export default ExternalDashboard;
