import './App.css';
import Navbar from './Components/Navbar';
import Footer from './Components/Footer';
import Home from './Components/Home';
import { BrowserRouter as Router, Link, Route, Routes } from 'react-router-dom';
import Products from './Components/ProductPage';
import ProductDetail from './Components/ProductDetail';
import ProductState from './Context/ProductState';
import CartPage from './Components/CartPage';
import Track from './Components/Track';
import Payment from './Components/Payment';
import Address from './Components/Address';
import Contact from './Components/Contact';
import About from './Components/About';
import Wishlist from './Components/Wishlist';
import Login from './Components/LoginPage'
import SignUp from './Components/Signup';
import Forgot from './Components/Forgot';
import Profile from './Components/UserProfile';
import ResetPassword from './Components/Reset';
import { Toaster } from 'react-hot-toast';
import { RequireAuth, GuestOnly } from './Components/RouteGuards';
import useDocumentTitle from './hooks/useDocumentTitle';
import ChatLauncher from './Components/chat/ChatLauncher';

// Route-level page title (the product page sets its own from the product name)
const Titled = ({ title, children }) => { useDocumentTitle(title); return children; };

// Unknown URLs get a real page instead of an empty layout
const NotFound = () => (
  <section className="fh-wrap cf-notfound">
    <div className="fh-script">oops</div>
    <h1 className="fh-h2">Page not found</h1>
    <p>The page you are looking for doesn&apos;t exist or has moved.</p>
    <div className="cf-notfound-actions">
      <Link to="/" className="fh-btn fh-btn-red">Back to home</Link>
      <Link to="/products" className="fh-btn fh-btn-ghost">Browse the menu</Link>
    </div>
  </section>
);

function Layout() {

  return (
    <>
      {/* below the sticky navbar, so a toast never covers the cart / menu buttons */}
      <Toaster position="top-center" reverseOrder={false} containerStyle={{ top: 84 }} />

      <Navbar />
      {/* the page area is always at least one screen tall, so the footer never flashes up while a page loads */}
      <div className="cf-page">
      <Routes>
        <Route path="/login" element={<Titled title="Login"><GuestOnly><Login /></GuestOnly></Titled>} />
        <Route path="/track" element={<Titled title="My orders"><RequireAuth><Track /></RequireAuth></Titled>} />
        <Route path="/signup" element={<Titled title="Sign up"><GuestOnly><SignUp /></GuestOnly></Titled>} />
        <Route path="/user/profile" element={<Titled title="My profile"><RequireAuth><Profile /></RequireAuth></Titled>} />
        <Route path="/forgot" element={<Titled title="Forgot password"><GuestOnly><Forgot /></GuestOnly></Titled>} />
        <Route path="/user/reset-password/:token" element={<Titled title="Reset password"><ResetPassword /></Titled>} />
        <Route path="/" element={<Titled title=""><Home /></Titled>} />
        {/* the menu sets its own title ("Menu" / the chosen category) */}
        <Route path="/products" element={<Products />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/cart" element={<Titled title="Cart"><RequireAuth><CartPage /></RequireAuth></Titled>} />
        <Route path="/payment" element={<Titled title="Payment"><RequireAuth><Payment /></RequireAuth></Titled>} />
        <Route path="/address" element={<Titled title="Delivery address"><RequireAuth><Address /></RequireAuth></Titled>} />
        <Route path="/contact" element={<Titled title="Contact"><Contact /></Titled>} />
        <Route path="/about" element={<Titled title="About"><About /></Titled>} />
        <Route path="*" element={<NotFound />} />
        <Route path="/wishlist" element={<Titled title="Wishlist"><RequireAuth><Wishlist /></RequireAuth></Titled>} />

      </Routes>
      </div>
      <Footer />
      <ChatLauncher />
    </>
  );
}

function App() {
  return (
    <ProductState>
      <Router>
        <Layout />
      </Router>
    </ProductState>
  );
}

export default App;
