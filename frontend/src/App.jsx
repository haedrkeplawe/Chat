import axios from "axios";
import MainURL from "../MainURL";
import { UserContextProvider } from "./context/UserContext";
import Routes from "./Routes";

axios.defaults.baseURL = MainURL;
axios.defaults.withCredentials = true;

function App() {
  return (
    <UserContextProvider>
      <Routes />
    </UserContextProvider>
  );
}

export default App;
