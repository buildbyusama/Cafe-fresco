import dashboard from './dashboard';
import Categories from './Categories';
import Orders from './Orders'
import Products from './Products';
import Permissions from './Permissions'
import User from './User'
import other from './other'
import workforce from './workforce';
import inventory from './inventory';
import ai from './ai';

// ==============================|| MENU ITEMS ||============================== //

const menuItems = {
  items: [dashboard, Categories, Products, Orders, Permissions, User, workforce, inventory, ai, other]
};

export default menuItems;
