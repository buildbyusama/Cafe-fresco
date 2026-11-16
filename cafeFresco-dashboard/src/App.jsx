import { RouterProvider } from 'react-router-dom';

// routing
import router from 'routes';

// project imports
import NavigationScroll from 'layout/NavigationScroll';
import ThemeCustomization from 'themes';
import MainProvider from './views/context/index.jsx';
import { NotifyProvider } from './contexts/NotifyContext';

// ==============================|| APP ||============================== //

export default function App() {



  return (
    <MainProvider>
      <ThemeCustomization>
        <NotifyProvider>
          <NavigationScroll>
            <RouterProvider router={router} />
          </NavigationScroll>
        </NotifyProvider>
      </ThemeCustomization>
    </MainProvider>
  );
}
