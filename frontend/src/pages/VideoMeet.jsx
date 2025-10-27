import React, { useState, useRef, useEffect } from "react";
import "../styles/videoMeet.css";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import io, { Socket } from "socket.io-client";
import Badge from "@mui/material/Badge";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatIcon from "@mui/icons-material/Chat";
import IconButton from "@mui/material/IconButton";
import SpeakerNotesOffIcon from "@mui/icons-material/SpeakerNotesOff";
import { useNavigate } from "react-router-dom";
import server from "../environment";


const server_url = server;
var connections = {};

const peerConfigConnections = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

function VideoMeet() {
  let socketRef = useRef();
  let socketIdRef = useRef();
  let localVideoRef = useRef();
  let [videoAvailable, setVideoAvailable] = useState(true);
  let [audioAvailable, setAudioAvailable] = useState(true);
  let [video, setVideo] = useState(true); // was []
  let [audio, setAudio] = useState(true); // was undefined
  let [screen, setScreen] = useState(false);
  let [showModal, setModal] = useState(true);
  let [screenAvailable, setScreenAvailable] = useState(false);
  let [messages, setMessages] = useState([]);
  let [message, setMessage] = useState("");
  let [newMessages, setNewMessages] = useState(0);
  let [askForUsername, setAskForUsername] = useState(true);
  let [username, setUsername] = useState("");

  const videoRef = useRef([]);

  let [videos, setVideos] = useState([]);

  let routeTo = useNavigate(); 

  //todo
  // if(isChrome()===false){

  // }

  //getPermission for video conferencing
  const getPermissions = async () => {
    try {
      // use local vars so we don't rely on setState being synchronous
      let hasVideo = false;
      let hasAudio = false;

      try {
        const videoPermissions = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        if (videoPermissions) {
          hasVideo = true;
          setVideoAvailable(true);
        } else {
          setVideoAvailable(false);
        }
      } catch (e) {
        setVideoAvailable(false);
      }

      try {
        const audioPermissions = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        if (audioPermissions) {
          hasAudio = true;
          setAudioAvailable(true);
        } else {
          setAudioAvailable(false);
        }
      } catch (e) {
        setAudioAvailable(false);
      }

      if (navigator.mediaDevices.getDisplayMedia) {
        setScreenAvailable(true);
      } else {
        setScreenAvailable(false);
      }

      // Use the local booleans we just computed
      if (hasVideo || hasAudio) {
        try {
          const userMediaStream = await navigator.mediaDevices.getUserMedia({
            video: hasVideo,
            audio: hasAudio,
          });

          if (userMediaStream) {
            window.localStream = userMediaStream;
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = userMediaStream;
            }
          }
        } catch (e) {
          console.log("Error obtaining combined media:", e);
        }
      }
    } catch (e) {
      console.log(e);
    }
  };

  //call getpermission
  useEffect(() => {
    getPermissions();
  }, []);

  //getUserMediaSuccess
  let getUserMediaSuccess = (stream) => {
    try {
      if (window.localStream) {
        window.localStream.getTracks().forEach((track) => track.stop());
      }
    } catch (e) {
      console.log(e);
    }

    window.localStream = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    for (let id in connections) {
      if (id === socketIdRef.current) continue;

      try {
        connections[id].addStream(window.localStream);
      } catch (e) {
        console.log("addStream error:", e);
      }

      connections[id].createOffer().then((description) => {
        console.log(description);
        connections[id]
          .setLocalDescription(description)
          .then(() => {
            // FIXED: use socketRef.current.emit (socket object) not socketIdRef.current.emit
            if (socketRef.current) {
              socketRef.current.emit(
                "signal",
                id,
                JSON.stringify({ sdp: connections[id].localDescription })
              );
            }
          })
          .catch((e) => console.log(e));
      });
    }

    stream.getTracks().forEach(
      (track) =>
        (track.onended = () => {
          setVideo(false);
          setAudio(false);

          try {
            if (localVideoRef.current && localVideoRef.current.srcObject) {
              let tracks = localVideoRef.current.srcObject.getTracks();
              tracks.forEach((track) => track.stop());
            }
          } catch (e) {
            console.log(e);
          }

          let blackSilence = (...args) =>
            new MediaStream([black(...args), silence()]);
          window.localStream = blackSilence();
          if (localVideoRef.current)
            localVideoRef.current.srcObject = window.localStream;

          for (let id in connections) {
            try {
              connections[id].addStream(window.localStream);

              connections[id].createOffer().then((description) => {
                connections[id]
                  .setLocalDescription(description)
                  .then(() => {
                    if (socketRef.current) {
                      socketRef.current.emit(
                        "signal",
                        id,
                        JSON.stringify({
                          sdp: connections[id].localDescription,
                        })
                      );
                    }
                  })
                  .catch((e) => console.log(e));
              });
            } catch (e) {
              console.log("error updating peer with black stream:", e);
            }
          }
        })
    );
  };

  //Silence
  let silence = () => {
    let ctx = new AudioContext();
    let oscillator = ctx.createOscillator();
    let dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    ctx.resume();
    return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
  };

  //Black
  let black = ({ width = 640, height = 480 } = {}) => {
    let canvas = Object.assign(document.createElement("canvas"), {
      width,
      height,
    });
    canvas.getContext("2d").fillRect(0, 0, width, height);
    let stream = canvas.captureStream();
    return Object.assign(stream.getVideoTracks()[0], { enabled: false });
  };

  //getUserMedia
  let getUserMedia = () => {
    if ((video && videoAvailable) || (audio && audioAvailable)) {
      navigator.mediaDevices
        .getUserMedia({ video: video, audio: audio })
        .then(getUserMediaSuccess)
        .then((strean) => {})
        .catch((e) => console.log(e));
    } else {
      try {
        if (localVideoRef.current && localVideoRef.current.srcObject) {
          let tracks = localVideoRef.current.srcObject.getTracks();
          tracks.forEach((track) => track.stop());
        }
      } catch (e) {
        console.log(e);
      }
    }
  };

  //call getUserMedia
  useEffect(() => {
    if (video !== undefined && audio !== undefined) {
      getUserMedia();
    }
  }, [audio, video]);

  //gotMessageFromServer
  let gotMessageFromServer = (fromId, message) => {
    var signal = JSON.parse(message);

    if (fromId !== socketIdRef.current) {
      if (signal.sdp) {
        connections[fromId]
          .setRemoteDescription(new RTCSessionDescription(signal.sdp))
          .then(() => {
            if (signal.sdp.type === "offer") {
              connections[fromId]
                .createAnswer()
                .then((description) => {
                  connections[fromId]
                    .setLocalDescription(description)
                    .then(() => {
                      if (socketRef.current) {
                        socketRef.current.emit(
                          "signal",
                          fromId,
                          JSON.stringify({
                            sdp: connections[fromId].localDescription,
                          })
                        );
                      }
                    })
                    .catch((e) => console.log(e));
                })
                .catch((e) => console.log(e));
            }
          })
          .catch((e) => console.log(e));
      }

      if (signal.ice) {
        connections[fromId]
          .addIceCandidate(new RTCIceCandidate(signal.ice))
          .catch((e) => console.log(e));
      }
    }
  };

  //Add Message
  let addMessage = (data, sender, socketIdSender) => {
    setMessages((prevMesseges) => [
      ...prevMesseges,
      { sender: sender, data: data },
    ]);

    if (socketIdSender !== socketRef.current) {
      setNewMessages((prevMesseges) => prevMesseges + 1);
    }
  };

  //ConnectToSocketServer
  let connectToSocketServer = () => {
    socketRef.current = io.connect(server_url, { secure: false });

    socketRef.current.on("signal", gotMessageFromServer);

    socketRef.current.on("connect", () => {
      socketRef.current.emit("join-call", window.location.href);

      socketIdRef.current = socketRef.current.id;

      socketRef.current.on("chat-message", addMessage);

      socketRef.current.on("user-left", (id) => {
        // FIXED: was setVideo, should remove remote video from list
        setVideos((videos) => videos.filter((video) => video.socketId !== id));
      });

      socketRef.current.on("user-joined", (id, clients) => {
        clients.forEach((socketListId) => {
          connections[socketListId] = new RTCPeerConnection(
            peerConfigConnections
          );

          connections[socketListId].onicecandidate = (event) => {
            if (event.candidate !== null) {
              if (socketRef.current) {
                socketRef.current.emit(
                  "signal",
                  socketListId,
                  JSON.stringify({ ice: event.candidate })
                );
              }
            }
          };

          connections[socketListId].onaddstream = (event) => {
            console.log("BEFORE:", videoRef.current);
            console.log("FINDING ID: ", socketListId);

            let videoExists = videoRef.current.find(
              (video) => video.socketId === socketListId
            );

            if (videoExists) {
              console.log("FOUND EXISTING");

              // Update the stream of the existing video
              setVideos((videos) => {
                const updatedVideos = videos.map((video) =>
                  video.socketId === socketListId
                    ? { ...video, stream: event.stream }
                    : video
                );
                videoRef.current = updatedVideos;
                return updatedVideos;
              });
            } else {
              // Create a new video
              console.log("CREATING NEW");
              let newVideo = {
                socketId: socketListId,
                stream: event.stream,
                autoplay: true,
                playsinline: true,
              };

              setVideos((videos) => {
                const updatedVideos = [...videos, newVideo];
                videoRef.current = updatedVideos;
                return updatedVideos;
              });
            }
          };

          // Add the local video stream
          if (window.localStream !== undefined && window.localStream !== null) {
            try {
              connections[socketListId].addStream(window.localStream);
            } catch (e) {
              console.log("addStream error:", e);
            }
          } else {
            let blackSilence = (...args) =>
              new MediaStream([black(...args), silence()]);
            window.localStream = blackSilence();
            try {
              connections[socketListId].addStream(window.localStream);
            } catch (e) {
              console.log("addStream error for blackSilence:", e);
            }
          }
        });

        if (id === socketIdRef.current) {
          for (let id2 in connections) {
            if (id2 === socketIdRef.current) continue;

            try {
              connections[id2].addStream(window.localStream);
            } catch (e) {}

            connections[id2].createOffer().then((description) => {
              connections[id2]
                .setLocalDescription(description)
                .then(() => {
                  if (socketRef.current) {
                    socketRef.current.emit(
                      "signal",
                      id2,
                      JSON.stringify({ sdp: connections[id2].localDescription })
                    );
                  }
                })
                .catch((e) => console.log(e));
            });
          }
        }
      });
    });
  };

  //getMedia
  let getMedia = () => {
    setVideo(videoAvailable);
    setAudio(audioAvailable);
    connectToSocketServer();
  };

  //call getaskuser and getMedia
  let connect = () => {
    setAskForUsername(false);
    getMedia();
  };

  let handleVideo = () => {
    setVideo(!video);
  };

  let handleAudio = () => {
    setAudio(!audio);
  };

  let getDisplayMediaSuccess = (stream) => {
    console.log("HERE");
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (e) {
      console.log(e);
    }

    window.localStream = stream;
    localVideoRef.current.srcObject = stream;

    for (let id in connections) {
      if (id === socketIdRef.current) continue;

      connections[id].addStream(window.localStream);

      connections[id].createOffer().then((description) => {
        connections[id]
          .setLocalDescription(description)
          .then(() => {
            socketRef.current.emit(
              "signal",
              id,
              JSON.stringify({ sdp: connections[id].localDescription })
            );
          })
          .catch((e) => console.log(e));
      });
    }

    stream.getTracks().forEach(
      (track) =>
        (track.onended = () => {
          setScreen(false);

          try {
            let tracks = localVideoRef.current.srcObject.getTracks();
            tracks.forEach((track) => track.stop());
          } catch (e) {
            console.log(e);
          }

          let blackSilence = (...args) =>
            new MediaStream([black(...args), silence()]);
          window.localStream = blackSilence();
          localVideoRef.current.srcObject = window.localStream;

          getUserMedia();
        })
    );
  };

  let getDisplayMedia = () => {
    if (screen) {
      if (navigator.mediaDevices.getDisplayMedia) {
        navigator.mediaDevices
          .getDisplayMedia({ video: true, audio: true })
          .then(getDisplayMediaSuccess)
          .then((stream) => {})
          .catch((e) => console.log(e));
      }
    }
  };

  useEffect(() => {
    if (screen !== undefined) {
      getDisplayMedia();
    }
  }, [screen]);

  let handleScreen = () => {
    setScreen(!screen);
  };

  let handleEndCall = () => {
    try {
      let tracks = localVideoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
    } catch (e) {}
    routeTo('/Home');
  };

  let sendMessage = () => {
    console.log(socketRef.current);
    socketRef.current.emit("chat-message", message, username);
    setMessage("");
  };

  return (
    <div>
      {askForUsername === true ? (
        <div>
          <h2>Enter into Lobby</h2>
          <TextField
            id="outlined-basic"
            label="Username"
            variant="outlined"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Button onClick={connect} variant="contained">
            Connect
          </Button>

          <div>
            <video ref={localVideoRef} autoPlay muted playsInline></video>
          </div>
        </div>
      ) : (
        <div className=" meetVideoContainer">
          {showModal ? (
            <div className="chatRoom">
              <div className="chatContainer">
                <h1>Chat</h1>

                <div className="chattingDisplay">
                  {messages.length !== 0 ? (
                    messages.map((item, index) => {
                      console.log(messages);
                      return (
                        <div style={{ marginBottom: "20px" }} key={index}>
                          <p style={{ fontWeight: "bold" }}>{item.sender}</p>
                          <p>{item.data}</p>
                        </div>
                      );
                    })
                  ) : (
                    <p>No Messages Yet</p>
                  )}
                </div>

                <div className="chattingArea">
                  <TextField
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    id="outlined-basic"
                    label="Enter Your chat"
                    variant="outlined"
                  />
                  <Button variant="contained" onClick={sendMessage}>
                    Send
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <></>
          )}

          <div className="buttonContainers">
            <IconButton onClick={handleVideo} style={{ color: "white" }}>
              {video === true ? <VideocamIcon /> : <VideocamOffIcon />}
            </IconButton>

            <IconButton onClick={handleEndCall} style={{ color: "red" }}>
              <CallEndIcon />
            </IconButton>

            <IconButton onClick={handleAudio} style={{ color: "white" }}>
              {audio === true ? <MicIcon /> : <MicOffIcon />}
            </IconButton>

            {screenAvailable === true ? (
              <IconButton onClick={handleScreen} style={{ color: "white" }}>
                {screen === true ? (
                  <ScreenShareIcon />
                ) : (
                  <StopScreenShareIcon />
                )}
              </IconButton>
            ) : (
              <></>
            )}

            <Badge badgeContent={newMessages} max={999} color="secondary">
              <IconButton
                onClick={() => setModal(!showModal)}
                style={{ color: "white" }}
              >
                {showModal ? <ChatIcon /> : <SpeakerNotesOffIcon />}
              </IconButton>
            </Badge>
          </div>

          <video
            className="meetUserVideo"
            ref={localVideoRef}
            autoPlay
            muted
          ></video>
          <div className="conferenceView">
            {videos.map((video) => (
              <div key={video.socketId}>
                <video
                  data-socket={video.socketId}
                  ref={(ref) => {
                    if (ref && video.stream) {
                      ref.srcObject = video.stream;
                    }
                  }}
                  autoPlay
                ></video>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoMeet;

//************************************* */

// import React, { useState, useRef, useEffect } from "react";
// import "../styles/VideoMeet.css";
// import TextField from "@mui/material/TextField";
// import Button from "@mui/material/Button";
// import io, { Socket } from "socket.io-client";
// import Badge from "@mui/material/Badge";
// import VideocamIcon from "@mui/icons-material/Videocam";
// import VideocamOffIcon from "@mui/icons-material/VideocamOff";
// import CallEndIcon from "@mui/icons-material/CallEnd";
// import MicIcon from "@mui/icons-material/Mic";
// import MicOffIcon from "@mui/icons-material/MicOff";
// import ScreenShareIcon from "@mui/icons-material/ScreenShare";
// import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
// import ChatIcon from "@mui/icons-material/Chat";
// import IconButton from "@mui/material/IconButton";

// const server_url = "http://localhost:8000";
// var connections = {};

// const peerConfigConnections = {
//   iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
// };

// function VideoMeet() {
//   let socketRef = useRef();
//   let socketIdRef = useRef();
//   let localVideoRef = useRef();
//   let [videoAvailable, setVideoAvailable] = useState(true);
//   let [audioAvailable, setAudioAvailable] = useState(true);
//   let [video, setVideo] = useState([]);
//   let [audio, setAudio] = useState();
//   let [screen, setScreen] = useState();
//   let [showModal, setModal] = useState();
//   let [screenAvailable, setScreenAvailable] = useState();
//   let [messages, setMessages] = useState([]);
//   let [message, setMessage] = useState("");
//   let [newMessages, setNewMessages] = useState(99);
//   let [askForUsername, setAskForUsername] = useState(true);
//   let [username, setUsername] = useState("");

//   const videoRef = useRef([]);

//   let [videos, setVideos] = useState([]);

//   //todo
//   // if(isChrome()===false){

//   // }

//   //getPermission for video conferencing
//   const getPermissions = async () => {
//     try {
//       const videoPermissions = await navigator.mediaDevices.getUserMedia({
//         video: true,
//       });
//       if (videoPermissions) {
//         setVideoAvailable(true);
//       } else {
//         setVideoAvailable(false);
//       }

//       const audioPermissions = await navigator.mediaDevices.getUserMedia({
//         audio: true,
//       });
//       if (audioPermissions) {
//         setAudioAvailable(true);
//       } else {
//         setAudioAvailable(false);
//       }

//       if (navigator.mediaDevices.getDisplayMedia) {
//         setScreenAvailable(true);
//       } else {
//         setScreenAvailable(false);
//       }

//       if (videoAvailable || audioAvailable) {
//         const userMediaStream = await navigator.mediaDevices.getUserMedia({
//           video: videoAvailable,
//           audio: audioAvailable,
//         });

//         if (userMediaStream) {
//           window.localStream = userMediaStream;
//           if (localVideoRef.current) {
//             localVideoRef.current.srcObject = userMediaStream;
//           }
//         }
//       }
//     } catch (e) {
//       console.log(e);
//     }
//   };

//   //call getpermission
//   useEffect(() => {
//     getPermissions();
//   }, []);

//   //getUserMediaSuccess
//   let getUserMediaSuccess = (stream) => {
//     try {
//       window.localStream.getTracks().forEach((track) => track.stop());
//     } catch (e) {
//       console.log(e);
//     }

//     window.localStream = stream;
//     localVideoRef.current.srcObject = stream;

//     for (let id in connections) {
//       if (id === socketIdRef.current) continue;

//       connections[id].addStream(window.localStream);

//       connections[id].createOffer().then((description) => {
//         console.log(description);
//         connections[id]
//           .setLocalDescription(description)
//           .then(() => {
//             socketIdRef.current.emit(
//               "signal",
//               id,
//               JSON.stringify({ sdp: connections[id].localDescription })
//             );
//           })
//           .catch((e) => console.log(e));
//       });
//     }

//     stream.getTracks().forEach(
//       (track) =>
//         (track.onended = () => {
//           setVideo(false);
//           setAudio(false);

//           try {
//             let tracks = localVideoRef.current.srcObject.getTracks();
//             tracks.forEach((track) => track.stop());
//           } catch (e) {
//             console.log(e);
//           }

//           let blackSilence = (...args) =>
//             new MediaStream([black(...args), silence()]);
//           window.localStream = blackSilence();
//           localVideoRef.current.srcObject = window.localStream;

//           for (let id in connections) {
//             connections[id].addStream(window.localStream);

//             connections[id].createOffer().then((description) => {
//               connections[id]
//                 .setLocalDescription(description)
//                 .then(() => {
//                   socketRef.current.emit(
//                     "signal",
//                     id,
//                     JSON.stringify({ sdp: connections[id].localDescription })
//                   );
//                 })
//                 .catch((e) => console.log(e));
//             });
//           }
//         })
//     );
//   };

//   //Silence
//   let silence = () => {
//     let ctx = new AudioContext();
//     let oscillator = ctx.createOscillator();
//     let dst = oscillator.connect(ctx.createMediaStreamDestination());
//     oscillator.start();
//     ctx.resume();
//     return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
//   };

//   //Black
//   let black = ({ width = 640, height = 480 } = {}) => {
//     let canvas = Object.assign(document.createElement("canvas"), {
//       width,
//       height,
//     });
//     canvas.getContext("2d").fillRect(0, 0, width, height);
//     let stream = canvas.captureStream();
//     return Object.assign(stream.getVideoTracks()[0], { enabled: false });
//   };

//   //getUserMedia
//   let getUserMedia = () => {
//     if ((video && videoAvailable) || (audio && audioAvailable)) {
//       navigator.mediaDevices
//         .getUserMedia({ video: video, audio: audio })
//         .then(getUserMediaSuccess)
//         .then((strean) => {})
//         .catch((e) => console.log(e));
//     } else {
//       try {
//         let tracks = localVideoRef.current.srcObject.getTracks();
//         tracks.forEach((track) => track.stop());
//       } catch (e) {
//         console.log(e);
//       }
//     }
//   };

//   //call getUserMedia
//   useEffect(() => {
//     if (video !== undefined && audio !== undefined) {
//       getUserMedia();
//     }
//   }, [audio, video]);

//   //gotMessageFromServer
//   let gotMessageFromServer = (fromId, message) => {
//     var signal = JSON.parse(message);

//     if (fromId !== socketIdRef.current) {
//       if (signal.sdp) {
//         connections[fromId]
//           .setRemoteDescription(new RTCSessionDescription(signal.sdp))
//           .then(() => {
//             if (signal.sdp.type === "offer") {
//               connections[fromId]
//                 .createAnswer()
//                 .then((description) => {
//                   connections[fromId]
//                     .setLocalDescription(description)
//                     .then(() => {
//                       socketRef.current.emit(
//                         "signal",
//                         fromId,
//                         JSON.stringify({
//                           sdp: connections[fromId].localDescription,
//                         })
//                       );
//                     })
//                     .catch((e) => console.log(e));
//                 })
//                 .catch((e) => console.log(e));
//             }
//           })
//           .catch((e) => console.log(e));
//       }

//       if (signal.ice) {
//         connections[fromId]
//           .addIceCandidate(new RTCIceCandidate(signal.ice))
//           .catch((e) => console.log(e));
//       }
//     }
//   };

//   //Add Message
//   let addMessage = () => {};

//   //ConnectToSocketServer
//   let connectToSocketServer = () => {
//     socketRef.current = io.connect(server_url, { secure: false });

//     socketRef.current.on("signal", gotMessageFromServer);

//     socketRef.current.on("connect", () => {
//       socketRef.current.emit("join-call", window.location.href);

//       socketIdRef.current = socketRef.current.id;

//       socketRef.current.on("chat-message", addMessage);

//       socketRef.current.on("user-left", (id) => {
//         setVideo((videos) => videos.filter((video) => video.socketId !== id));
//       });

//       socketRef.current.on("user-joined", (id, clients) => {
//         clients.forEach((socketListId) => {
//           connections[socketListId] = new RTCPeerConnection(
//             peerConfigConnections
//           );

//           connections[socketListId].onicecandidate = (event) => {
//             if (event.candidate !== null) {
//               socketRef.current.emit(
//                 "signal",
//                 socketListId,
//                 JSON.stringify({ ice: event.candidate })
//               );
//             }
//           };

//           connections[socketListId].onaddstream = (event) => {
//             console.log("BEFORE:", videoRef.current);
//             console.log("FINDING ID: ", socketListId);

//             let videoExists = videoRef.current.find(
//               (video) => video.socketId === socketListId
//             );

//             if (videoExists) {
//               console.log("FOUND EXISTING");

//               // Update the stream of the existing video
//               setVideos((videos) => {
//                 const updatedVideos = videos.map((video) =>
//                   video.socketId === socketListId
//                     ? { ...video, stream: event.stream }
//                     : video
//                 );
//                 videoRef.current = updatedVideos;
//                 return updatedVideos;
//               });
//             } else {
//               // Create a new video
//               console.log("CREATING NEW");
//               let newVideo = {
//                 socketId: socketListId,
//                 stream: event.stream,
//                 autoplay: true,
//                 playsinline: true,
//               };

//               setVideos((videos) => {
//                 const updatedVideos = [...videos, newVideo];
//                 videoRef.current = updatedVideos;
//                 return updatedVideos;
//               });
//             }
//           };

//           // Add the local video stream
//           if (window.localStream !== undefined && window.localStream !== null) {
//             connections[socketListId].addStream(window.localStream);
//           } else {
//             let blackSilence = (...args) =>
//               new MediaStream([black(...args), silence()]);
//             window.localStream = blackSilence();
//             connections[socketListId].addStream(window.localStream);
//           }
//         });

//         if (id === socketIdRef.current) {
//           for (let id2 in connections) {
//             if (id2 === socketIdRef.current) continue;

//             try {
//               connections[id2].addStream(window.localStream);
//             } catch (e) {}

//             connections[id2].createOffer().then((description) => {
//               connections[id2]
//                 .setLocalDescription(description)
//                 .then(() => {
//                   socketRef.current.emit(
//                     "signal",
//                     id2,
//                     JSON.stringify({ sdp: connections[id2].localDescription })
//                   );
//                 })
//                 .catch((e) => console.log(e));
//             });
//           }
//         }
//       });
//     });
//   };

//   //getMedia
//   let getMedia = () => {
//     setVideo(videoAvailable);
//     setAudio(audioAvailable);
//     connectToSocketServer();
//   };

//   //call getaskuser and getMedia
//   let connect = () => {
//     setAskForUsername(false);
//     getMedia();
//   };

//   let handleVideo = () => {
//     setVideo(!video);
//   };

//   let handleAudio = () => {
//     setAudio(!audio);
//   };

//   return (
//     <div>
//       {askForUsername === true ? (
//         <div>
//           <h2>Enter into Lobby</h2>
//           <TextField
//             id="outlined-basic"
//             label="Username"
//             variant="outlined"
//             value={username}
//             onChange={(e) => setUsername(e.target.value)}
//           />
//           <Button onClick={connect} variant="contained">
//             Connect
//           </Button>

//           <div>
//             <video ref={localVideoRef} autoPlay muted></video>
//           </div>
//         </div>
//       ) : (
//         <div className=" meetVideoContainer">
//           <div className="buttonContainers">
//             <IconButton onClick={handleVideo} style={{ color: "white" }}>
//               {video === true ? <VideocamIcon /> : <VideocamOffIcon />}
//             </IconButton>

//             <IconButton style={{ color: "red" }}>
//               <CallEndIcon />
//             </IconButton>

//             <IconButton onClick={handleAudio} style={{ color: "white" }}>
//               {audio === true ? <MicIcon /> : <MicOffIcon />}
//             </IconButton>

//             {screenAvailable === true ? (
//               <IconButton style={{ color: "white" }}>
//                 {screen === true ? (
//                   <ScreenShareIcon />
//                 ) : (
//                   <StopScreenShareIcon />
//                 )}
//               </IconButton>
//             ) : (
//               <></>
//             )}

//             <Badge badgeContent={newMessages} max={999} color="secondary">
//               <IconButton style={{ color: "white" }}>
//                 <ChatIcon />
//               </IconButton>
//             </Badge>
//           </div>

//           <video
//             className="meetUserVideo"
//             ref={localVideoRef}
//             autoPlay
//             muted
//           ></video>
//           <div>
//             {videos.map((video) => (
//               <div className="conferenceView" key={video.socketId}>
//                 <video
//                   data-socket={video.socketId}
//                   ref={(ref) => {
//                     if (ref && video.stream) {
//                       ref.srcObject = video.stream;
//                     }
//                   }}
//                   autoPlay
//                 ></video>
//               </div>
//             ))}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// export default VideoMeet;
