import Assistant from './pages/Assistant';
import CompanySetup from './pages/CompanySetup';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import InvoiceConfirmation from './pages/InvoiceConfirmation';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import Taxes from './pages/Taxes';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Assistant": Assistant,
    "CompanySetup": CompanySetup,
    "Dashboard": Dashboard,
    "Documents": Documents,
    "InvoiceConfirmation": InvoiceConfirmation,
    "Notifications": Notifications,
    "Settings": Settings,
    "Taxes": Taxes,
}

export const pagesConfig = {
    mainPage: "Assistant",
    Pages: PAGES,
    Layout: __Layout,
};
