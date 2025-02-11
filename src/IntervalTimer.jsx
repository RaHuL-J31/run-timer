import { useState, useEffect, useCallback } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX } from "lucide-react";

const IntervalTimer = () => {
  const [inputs, setInputs] = useState({
    runTime: "",
    walkTime: "",
    repetitions: "",
  });
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [currentPhase, setCurrentPhase] = useState("SETUP");
  const [currentRep, setCurrentRep] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [audioContext, setAudioContext] = useState(null);
  // Add new state for total elapsed time
  const [elapsedTime, setElapsedTime] = useState(0);

  // Speech synthesis setup
  const [speechSynthesis, setSpeechSynthesis] = useState(null);

  useEffect(() => {
    if (window.speechSynthesis) {
      setSpeechSynthesis(window.speechSynthesis);
    }
  }, []);

  // Add effect for tracking total elapsed time
  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  // Voice announcement function
  const announcePhase = useCallback(
    (phase) => {
      if (!speechSynthesis || !isSoundEnabled) return;

      // Cancel any ongoing speech
      speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(phase);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      speechSynthesis.speak(utterance);
    },
    [speechSynthesis, isSoundEnabled]
  );

  // Audio Context setup
  useEffect(() => {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    setAudioContext(context);
    return () => {
      context.close();
    };
  }, []);

  // Sound generation functions
  const playTick = useCallback(() => {
    if (!audioContext || !isSoundEnabled) return;

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.frequency.setValueAtTime(800, audioContext.currentTime);
    gain.gain.setValueAtTime(0.1, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.1
    );

    osc.start();
    osc.stop(audioContext.currentTime + 0.1);
  }, [audioContext, isSoundEnabled]);

  const playPhaseChange = useCallback(
    (isRunPhase) => {
      if (!audioContext || !isSoundEnabled) return;

      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc.connect(gain);
      gain.connect(audioContext.destination);

      osc.frequency.setValueAtTime(
        isRunPhase ? 880 : 440,
        audioContext.currentTime
      );
      gain.gain.setValueAtTime(0.3, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.5
      );

      osc.start();
      osc.stop(audioContext.currentTime + 0.5);

      // Announce the phase after the tone
      setTimeout(() => {
        announcePhase(isRunPhase ? "RUN" : "WALK");
      }, 500);
    },
    [audioContext, isSoundEnabled, announcePhase]
  );

  // Timer logic with sound and voice
  useEffect(() => {
    let interval;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          // Play tick sound for last 5 seconds
          if (prev <= 6 && prev > 1) {
            playTick();
          }
          return prev - 1;
        });
      }, 1000);
    } else if (isRunning && timeLeft === 0) {
      if (currentPhase === "RUN") {
        if (currentRep < parseInt(inputs.repetitions)) {
          setCurrentPhase("WALK");
          setTimeLeft(parseInt(inputs.walkTime));
          playPhaseChange(false);
        } else {
          handleReset();
          announcePhase("Workout Complete");
        }
      } else if (currentPhase === "WALK") {
        setCurrentRep((prev) => prev + 1);
        if (currentRep + 1 < parseInt(inputs.repetitions)) {
          setCurrentPhase("RUN");
          setTimeLeft(parseInt(inputs.runTime));
          playPhaseChange(true);
        } else {
          handleReset();
          announcePhase("Workout Complete");
        }
      }
    }
    return () => clearInterval(interval);
  }, [
    isRunning,
    timeLeft,
    currentPhase,
    currentRep,
    inputs,
    playTick,
    playPhaseChange,
    announcePhase,
  ]);

  // Previous helper functions
  const validateInputs = () => {
    const { runTime, walkTime, repetitions } = inputs;
    if (!runTime || !walkTime || !repetitions) return false;
    if (runTime <= 0 || walkTime <= 0 || repetitions <= 0) return false;
    return true;
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const calculateProgress = () => {
    if (currentPhase === "SETUP") return 0;
    const totalSeconds =
      parseInt(inputs.repetitions) *
      (parseInt(inputs.runTime) + parseInt(inputs.walkTime));
    const completedSeconds = totalTime - timeLeft;
    return (completedSeconds / totalSeconds) * 100;
  };

  const handleStart = () => {
    if (!validateInputs()) return;
    if (currentPhase === "SETUP") {
      setCurrentPhase("RUN");
      setCurrentRep(1);
      setTimeLeft(parseInt(inputs.runTime));
      setTotalTime(parseInt(inputs.runTime) + parseInt(inputs.walkTime));
      setElapsedTime(0); // Reset elapsed time when starting new workout
      // Slight delay for initial announcement
      setTimeout(() => {
        playPhaseChange(true);
      }, 500);
    }
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
    if (isSoundEnabled) {
      announcePhase("Paused");
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setCurrentPhase("SETUP");
    setCurrentRep(0);
    setTimeLeft(0);
    //setElapsedTime(0); // Reset elapsed time
    setInputs({ runTime: "", walkTime: "", repetitions: "" });
    if (isSoundEnabled && currentPhase !== "SETUP") {
      announcePhase("Reset");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 flex flex-col items-center justify-start gap-8">
      {/* Sound Toggle Button */}
      <button
        onClick={() => setIsSoundEnabled(!isSoundEnabled)}
        className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-200"
      >
        {isSoundEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
      </button>

      {/* Input Section */}
      <div className="w-full max-w-md space-y-4 bg-white p-6 rounded-lg shadow-md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Run Time (seconds)
            </label>
            <input
              type="number"
              value={inputs.runTime}
              onChange={(e) =>
                setInputs((prev) => ({ ...prev, runTime: e.target.value }))
              }
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
              min="1"
              disabled={isRunning}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Walk Time (seconds)
            </label>
            <input
              type="number"
              value={inputs.walkTime}
              onChange={(e) =>
                setInputs((prev) => ({ ...prev, walkTime: e.target.value }))
              }
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
              min="1"
              disabled={isRunning}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Repetitions
            </label>
            <input
              type="number"
              value={inputs.repetitions}
              onChange={(e) =>
                setInputs((prev) => ({ ...prev, repetitions: e.target.value }))
              }
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
              min="1"
              disabled={isRunning}
            />
          </div>
        </div>
      </div>

      {/* Timer Display Section */}
      <div className="w-full max-w-md bg-white p-6 rounded-lg shadow-md text-center">
        <div className="mb-4">
          <div
            className={`text-6xl font-bold mb-2 ${
              currentPhase === "RUN"
                ? "text-green-600"
                : currentPhase === "WALK"
                ? "text-blue-600"
                : "text-gray-600"
            }`}
          >
            {formatTime(timeLeft)}
          </div>
          <div className="text-xl font-semibold text-gray-700">
            {currentPhase === "SETUP" ? "Ready" : currentPhase}
          </div>
          {currentPhase !== "SETUP" && (
            <div className="text-sm text-gray-600">
              Rep {currentRep} of {inputs.repetitions}
            </div>
          )}
          {/* Add Total Elapsed Time Display */}
          <div className="text-sm text-gray-600 mt-2">
            Total Time: {formatTime(elapsedTime)}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-1000"
            style={{ width: `${calculateProgress()}%` }}
          />
        </div>
      </div>

      {/* Control Buttons Section */}
      <div className="w-full max-w-md flex justify-center gap-4">
        {!isRunning ? (
          <button
            onClick={handleStart}
            disabled={!validateInputs()}
            className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-lg shadow hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <Play size={24} />
            <span>Start</span>
          </button>
        ) : (
          <button
            onClick={handlePause}
            className="flex items-center gap-2 px-6 py-3 bg-yellow-500 text-white rounded-lg shadow hover:bg-yellow-600"
          >
            <Pause size={24} />
            <span>Pause</span>
          </button>
        )}
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-lg shadow hover:bg-red-600"
        >
          <RotateCcw size={24} />
          <span>Reset</span>
        </button>
      </div>
    </div>
  );
};

export default IntervalTimer;
