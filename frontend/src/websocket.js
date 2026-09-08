const WS_URL = "ws://localhost:8000/ws";


export function connectWebSocket(
  onMessage,
  onConnectionChange
) {

  let socket = null;

  let reconnectTimer = null;

  let reconnectAttempts = 0;

  let manuallyClosed = false;


  // --------------------------------------------------
  // CONNECT
  // --------------------------------------------------

  const connect = () => {

    if (manuallyClosed) {
      return;
    }


    console.log(
      "Connecting to WebSocket..."
    );


    socket = new WebSocket(
      WS_URL
    );


    // ------------------------------------------------
    // CONNECTION OPEN
    // ------------------------------------------------

    socket.onopen = () => {

      console.log(
        "WebSocket connected"
      );


      reconnectAttempts = 0;


      onConnectionChange(
        true
      );

    };


    // ------------------------------------------------
    // MESSAGE
    // ------------------------------------------------

    socket.onmessage = (event) => {

      try {

        const message =
          JSON.parse(
            event.data
          );


        onMessage(
          message
        );

      } catch (error) {

        console.error(
          "Invalid WebSocket message:",
          error
        );

      }

    };


    // ------------------------------------------------
    // ERROR
    // ------------------------------------------------

    socket.onerror = (error) => {

      console.error(
        "WebSocket error:",
        error
      );

    };


    // ------------------------------------------------
    // CLOSE
    // ------------------------------------------------

    socket.onclose = () => {

      console.log(
        "WebSocket disconnected"
      );


      onConnectionChange(
        false
      );


      scheduleReconnect();

    };

  };


  // --------------------------------------------------
  // RECONNECT
  // --------------------------------------------------

  const scheduleReconnect = () => {

    if (manuallyClosed) {
      return;
    }


    const delay =
      Math.min(
        1000 *
          Math.pow(
            2,
            reconnectAttempts
          ),
        10000
      );


    console.log(
      `Reconnecting in ${
        delay / 1000
      } seconds...`
    );


    reconnectAttempts++;


    reconnectTimer =
      setTimeout(() => {

        connect();

      }, delay);

  };


  // --------------------------------------------------
  // START CONNECTION
  // --------------------------------------------------

  connect();


  // --------------------------------------------------
  // RETURN CONTROLLER
  // --------------------------------------------------

  return {

    close: () => {

      console.log(
        "Closing WebSocket manually"
      );


      manuallyClosed = true;


      if (reconnectTimer) {

        clearTimeout(
          reconnectTimer
        );

      }


      if (socket) {

        socket.close();

      }

    }

  };

}