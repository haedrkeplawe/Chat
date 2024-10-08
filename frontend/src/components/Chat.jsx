import { useContext, useEffect, useRef, useState } from "react";
import Avatar from "./Avatar";
import Logo from "./Logo";
import { UserContext } from "../context/UserContext";
import { uniqBy } from "lodash";
import axios from "axios";
import Contact from "./Contact";
import MainURL from "../../MainURL";

const Chat = () => {
  const [ws, setWs] = useState(null);
  const [onlinePeople, setOnlinePeople] = useState({});
  const [offlinePeople, setOfflinePeople] = useState({});
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [newMessageText, setNewMessageText] = useState("");
  const [messages, setMessages] = useState([]);
  const { username, id, setId, setUsername } = useContext(UserContext);
  const divUnderMessages = useRef();

  useEffect(() => {
    connectToWs();
  }, []);

  function connectToWs() {
    const ws = new WebSocket("ws://localhost:4000");
    setWs(ws);
    ws.addEventListener("message", handleMessage);
    ws.addEventListener("close", () => {
      setTimeout(() => {
        console.log("tray connect agayn");
        connectToWs();
      }, 1000);
    });
  }

  function showOnlinePeople(peopleArray) {
    const people = {};
    peopleArray.forEach(({ userId, username }) => {
      people[userId] = username;
    });
    setOnlinePeople(people);
  }

  function handleMessage(ev) {
    const messageData = JSON.parse(ev.data);

    if ("online" in messageData) {
      showOnlinePeople(messageData.online);
    } else if ("text" in messageData) {
      if (messageData.sender === selectedUserId) {
        setMessages((prev) => [...prev, { ...messageData }]);
      }
    }
  }

  function logout() {
    axios.post("/logout").then(() => {
      setWs(null);
      setId(null);
      setUsername(null);
    });
  }

  function sendMessage(ev, file = null) {
    if (ev) ev.preventDefault();
    ws.send(
      JSON.stringify({
        recipient: selectedUserId,
        text: newMessageText,
        file,
      })
    );

    if (file) {
      axios.get("/messages/" + selectedUserId).then((res) => {
        setMessages(res.data);
      });
    } else {
      setNewMessageText("");
      setMessages((prev) => [
        ...prev,
        {
          text: newMessageText,
          sender: id,
          recipient: selectedUserId,
          _id: Date.now(),
        },
      ]);
    }
  }

  function sendFile(ev) {
    const reader = new FileReader();
    reader.readAsDataURL(ev.target.files[0]);
    reader.onload = () => {
      sendMessage(null, {
        name: ev.target.files[0].name,
        data: reader.result,
      });
    };
  }

  useEffect(() => {
    const div = divUnderMessages.current;
    if (div) {
      div.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  useEffect(() => {
    axios.get("/people").then((res) => {
      const offlinePeopleArr = res.data
        .filter((p) => p._id !== id)
        .filter((p) => !Object.keys(onlinePeople).includes(p._id));
      const offlinePeople = {};
      offlinePeopleArr.forEach((p) => {
        offlinePeople[p._id] = p;
      });
      setOfflinePeople(offlinePeople);
    });
  }, [onlinePeople]);

  useEffect(() => {
    if (selectedUserId) {
      axios.get("/messages/" + selectedUserId).then((res) => {
        setMessages(res.data);
      });
    }
  }, [selectedUserId]);

  const onlinePeopleExclourUser = { ...onlinePeople };
  delete onlinePeopleExclourUser[id];

  const messagesWithOutDupes = uniqBy(messages, "_id");

  return (
    <div className="flex h-screen">
      <div className="bg-white w-1/3 flex flex-col ">
        <div className="flex-grow">
          <Logo />
          {Object.keys(onlinePeopleExclourUser).map((userId) => (
            <Contact
              key={userId}
              id={userId}
              username={onlinePeopleExclourUser[userId]}
              onClick={() => setSelectedUserId(userId)}
              selected={userId === selectedUserId}
              online={true}
            />
          ))}
          {Object.keys(offlinePeople).map((userId) => (
            <Contact
              key={userId}
              id={userId}
              username={offlinePeople[userId].username}
              onClick={() => setSelectedUserId(userId)}
              selected={userId === selectedUserId}
              online={false}
            />
          ))}
        </div>
        <div className="p-2 text-center">
          <span className="mr-2 text-sm text-gray-600">{username}</span>
          <button
            onClick={logout}
            className="text-sm bg-blue-100 py-1 px-2 text-gray-500 border rounded-sm"
          >
            Logout
          </button>
        </div>
      </div>
      <div className="flex flex-col bg-blue-50 w-2/3 p-2">
        <div className="flex-grow">
          {!selectedUserId && (
            <div className="flex h-full flex-grow  items-center justify-center">
              <div className="text-gray-400">&larr; Select a person</div>
            </div>
          )}
          {!!selectedUserId && (
            <div className="relative h-full">
              <div className="overflow-y-scroll absolute top-0 left-0 right-0 bottom-2">
                {messagesWithOutDupes.map((message) => (
                  <div
                    key={message._id}
                    className={
                      message.sender === id ? "text-right" : "text-left"
                    }
                  >
                    <div
                      className={
                        "text-left inline-block p-2 my-2 rounded-sm text-sm " +
                        (message.sender === id
                          ? "bg-blue-500 text-white"
                          : "bg-white text-gray-500")
                      }
                    >
                      {message.text}
                      {message.file && (
                        <div className="">
                          <a
                            to={"_balnk"}
                            className="flex items-center gap-1 border-b"
                            href={MainURL + "/uploads/" + message.file}
                          >
                            <span>svg</span>
                            {message.file}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={divUnderMessages}></div>
              </div>
            </div>
          )}
        </div>
        {!!selectedUserId && (
          <form className="flex gap-2" onSubmit={sendMessage}>
            <input
              value={newMessageText}
              onChange={(ev) => setNewMessageText(ev.target.value)}
              type="text"
              placeholder="Type your message here"
              className="bg-white flex-grow border p-2 rounded-sm"
            />
            <label
              type="button"
              className="bg-gray-300 p-2 text-gray-500 cursor-pointer rounded-sm"
            >
              <input type="file" className="hidden" onChange={sendFile} />
              atta
            </label>
            <button
              type="submit"
              className="bg-blue-500 p-2 text-white rounded-sm"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="size-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
                />
              </svg>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Chat;
