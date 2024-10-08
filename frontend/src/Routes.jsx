import { useContext } from "react";
import RegisterAndLoginForm from "./pages/RegisterAndLoginForm";
import { UserContext } from "./context/UserContext";
import Chat from "./components/Chat";

const Routes = () => {
  const { username, id } = useContext(UserContext);

  if (username) {
    return <Chat />;
  }

  return <RegisterAndLoginForm />;
};

export default Routes;
