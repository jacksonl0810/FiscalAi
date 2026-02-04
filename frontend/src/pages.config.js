import Assistant from './pages/Assistant';
import CompanySetup from './pages/CompanySetup';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import Clients from './pages/Clients';
import InvoiceConfirmation from './pages/InvoiceConfirmation';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import Taxes from './pages/Taxes';
import Admin from './pages/Admin';
import AccountantReview from './pages/AccountantReview';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Assistant": Assistant,
    "CompanySetup": CompanySetup,
    "Dashboard": Dashboard,
    "Documents": Documents,
    "Clients": Clients,
    "InvoiceConfirmation": InvoiceConfirmation,
    "Notifications": Notifications,
    "Settings": Settings,
    "Taxes": Taxes,
    "Admin": Admin,
    "AccountantReview": AccountantReview,
}

export const pagesConfig = {
    mainPage: "Assistant",
    Pages: PAGES,
    Layout: __Layout,
};
