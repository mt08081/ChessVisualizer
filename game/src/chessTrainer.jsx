import React, { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { Heart, RotateCcw, Home, Trophy, Play, CheckCircle, XCircle } from 'lucide-react';

// --- MOCK DATABASE OF VALID FENS BY PIECE COUNT ---
// In a production app, you can expand this dictionary with thousands of positions.
const FEN_DATABASE = {
  easy: [ // 3-5 pieces
    '8/8/8/4k3/8/8/4P3/4K3 w - - 0 1',
    'k7/8/R7/8/8/8/4P3/4K3 w - - 0 1',
    'r3k3/8/8/8/8/8/8/4K3 w q - 0 1',
    '4k3/8/8/8/8/8/3P4/2K1N3 w - - 0 1',
    '8/4k3/8/8/8/3N4/4P3/4K3 w - - 0 1'
  ],
  medium: [ // 5-7 pieces
    'k7/8/P7/8/8/3B4/4P3/4K3 w - - 0 1',
    'r3k3/8/8/8/8/5B2/4P3/4K3 w q - 0 1',
    '4k3/8/8/3p4/4P3/8/8/4KBN1 w - - 0 1',
    '2k5/8/8/3r4/8/3R4/4P3/4K3 w - - 0 1',
    'r3k2r/8/8/8/8/8/4P3/4K3 w qQ - 0 1'
  ],
  hard: [ // 7-9 pieces
    'r3k2r/pP6/8/8/8/8/4P3/4K3 w q - 0 1',
    'r3k2r/pb6/8/8/3P4/8/4P3/4KBN1 w q - 0 1',
    '2kr3r/pp6/8/8/8/8/PPP3PP/4K3 w - - 0 1',
    'r3k2r/pp6/8/8/3N4/8/PPP3PP/4K3 w q - 0 1',
    'r1bqk2r/pppp1ppp/2n5/8/8/8/8/4K3 w kq - 0 1'
  ],
  extreme: [ // 9-11 pieces
    'r1bqk2r/pppp1ppp/2n5/4p3/8/8/PPPP1PPP/R1BQK2R w KQkq - 0 1',
    'rnbqk2r/ppppppbp/5np1/8/8/5NP1/PPPPPPBP/RNBQK2R w KQkq - 0 1',
    'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1',
    '2kr1bnr/pppq1ppp/2np4/4p3/4P3/2NP4/PPPLQPPP/2KR1BNR w - - 0 1'
  ],
  impossible: [ // 11+ pieces
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    'r1bqkbnr/pppppppp/n7/8/8/N7/PPPPPPPP/R1BQKBNR w KQkq - 0 1',
    'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 1',
    'r1bqk2r/ppp2ppp/2np1n2/4p3/4P3/2NP1N2/PPP2PPP/R1BQKB1R w KQkq - 0 1'
  ]
};

const PIECES = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];

export default function ChessVisionTrainer() {
  // Game Navigation States: 'start' | 'memorize' | 'reconstruct' | 'gameover'
  const [gameState, setGameState] = useState('start');
  const [difficulty, setDifficulty] = useState('easy');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [leaderboard, setLeaderboard] = useState({});

  // Chess Board States
  const [targetFen, setTargetFen] = useState('');
  const [boardWidth, setBoardWidth] = useState(480);
  const [reconstructedPieces, setReconstructedPieces] = useState({}); 
  const [feedback, setFeedback] = useState({ type: '', message: '' }); // 'success' | 'error'
  const [countdown, setCountdown] = useState(3);
  
  const timerRef = useRef(null);
  const boardContainerRef = useRef(null);

  // Load Leaderboard on mount
  useEffect(() => {
    const savedScores = localStorage.getItem('chess_vision_leaderboard');
    if (savedScores) {
      setLeaderboard(JSON.parse(savedScores));
    } else {
      const initial = { easy: 0, medium: 0, hard: 0, extreme: 0, impossible: 0 };
      localStorage.setItem('chess_vision_leaderboard', JSON.stringify(initial));
      setLeaderboard(initial);
    }

    // Handle responsive board sizing
    const handleResize = () => {
      if (boardContainerRef.current) {
        const width = Math.min(boardContainerRef.current.clientWidth, 480);
        setBoardWidth(width);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update high score helper
  const updateHighScore = (diff, finalScore) => {
    const currentHigh = leaderboard[diff] || 0;
    if (finalScore > currentHigh) {
      const updated = { ...leaderboard, [diff]: finalScore };
      setLeaderboard(updated);
      localStorage.setItem('chess_vision_leaderboard', JSON.stringify(updated));
      return true;
    }
    return false;
  };

  // --- GAME LOOP LOGIC ---
  
  const startGame = (selectedDifficulty) => {
    setDifficulty(selectedDifficulty);
    setScore(0);
    setLives(3);
    setFeedback({ type: '', message: '' });
    nextLevel(selectedDifficulty);
  };

  const nextLevel = (currDiff = difficulty) => {
    setFeedback({ type: '', message: '' });
    setReconstructedPieces({});
    
    // Pick a random FEN from the chosen tier
    const pool = FEN_DATABASE[currDiff];
    const randomFen = pool[Math.floor(Math.random() * pool.length)];
    setTargetFen(randomFen);
    
    // Begin Memorization Phase
    setGameState('memorize');
    setCountdown(3);

    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setGameState('reconstruct');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Convert custom state back to an abstract positioning object for react-chessboard
  const handleSquareClick = (square, piece) => {
    if (gameState !== 'reconstruct') return;
    if (!piece) {
      // If clicking an occupied square without selecting a piece from a bank, remove it
      const updated = { ...reconstructedPieces };
      delete updated[square];
      setReconstructedPieces(updated);
    }
  };

  const handlePieceDrop = (sourceSquare, targetSquare, piece) => {
    if (gameState !== 'reconstruct') return false;
    
    const updated = { ...reconstructedPieces };
    // If dragging an existing piece on the board
    if (sourceSquare !== 'outside') {
      delete updated[sourceSquare];
    }
    // Set piece on the destination square
    if (targetSquare) {
      updated[targetSquare] = piece;
    }
    setReconstructedPieces(updated);
    return true;
  };

  const addPieceToSquare = (square, piece) => {
    setReconstructedPieces(prev => ({ ...prev, [square]: piece }));
  };

  const submitPosition = () => {
    // Standardize comparison using chess.js
    const targetChess = new Chess(targetFen);
    const userChess = new Chess();
    userChess.clear();

    // Load user pieces into a clean chess instance
    Object.entries(reconstructedPieces).forEach(([square, piece]) => {
      const type = piece[1].toLowerCase();
      const color = piece[0];
      userChess.put({ type, color }, square);
    });

    // Check mapping match (strictly piece-to-square positions)
    let isCorrect = true;
    const columns = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    for (let r = 1; r <= 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = `${columns[c]}${r}`;
        const targetP = targetChess.get(sq);
        const userP = userChess.get(sq);

        if (!targetP && !userP) continue;
        if ((!targetP && userP) || (targetP && !userP) || (targetP.type !== userP.type || targetP.color !== userP.color)) {
          isCorrect = false;
          break;
        }
      }
      if (!isCorrect) break;
    }

    if (isCorrect) {
      setFeedback({ type: 'success', message: 'Perfect match! Preparing next level...' });
      setScore(prev => prev + 1);
      setTimeout(() => {
        nextLevel();
      }, 1500);
    } else {
      const remainingLives = lives - 1;
      setLives(remainingLives);
      
      if (remainingLives <= 0) {
        setFeedback({ type: 'error', message: 'Incorrect position!' });
        setTimeout(() => {
          updateHighScore(difficulty, score);
          setGameState('gameover');
        }, 1500);
      } else {
        setFeedback({ type: 'error', message: `Wrong position! You lost a life (${remainingLives} left). Try adjusting your pieces.` });
      }
    }
  };

  const skipLevel = () => {
    const remainingLives = lives - 1;
    setLives(remainingLives);
    if (remainingLives <= 0) {
      updateHighScore(difficulty, score);
      setGameState('gameover');
    } else {
      nextLevel();
    }
  };

  // --- SUB COMPONENTS ---

  // Custom piece selection tray
  const PieceBank = () => {
    return (
      <div className="mt-4 p-3 bg-slate-800 rounded-xl border border-slate-700 w-full max-w-[480px]">
        <p className="text-xs text-slate-400 mb-2 text-center font-medium uppercase tracking-wider">
          Click a square on the board to clear it, or drop pieces onto it
        </p>
        <div className="grid grid-cols-6 gap-2 justify-items-center">
          {PIECES.map((piece) => {
            // Mapping codes to HTML entities for basic drag reference/display if needed
            const label = piece;
            return (
              <div
                key={piece}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', piece);
                }}
                className="w-10 h-10 bg-slate-700 hover:bg-slate-600 rounded flex items-center justify-center text-xl font-bold cursor-grab active:cursor-grabbing text-white border border-slate-600 select-none transition-colors"
                title={`Drag ${piece} to the board`}
              >
                {label}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 antialiased font-sans">
      
      {/* 1. START SCREEN */}
      {gameState === 'start' && (
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 text-center animate-in fade-in duration-300">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">
              Chess Vision Trainer
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Memorize the board positions in 3 seconds. Reconstruct perfectly to survive.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xs font-semibold tracking-wider text-slate-500 uppercase text-left pl-1">
              Select Difficulty Tiers
            </h2>
            {Object.keys(FEN_DATABASE).map((tier) => (
              <button
                key={tier}
                onClick={() => startGame(tier)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-xl text-left capitalize font-medium group transition-all hover:scale-[1.01]"
              >
                <span className="flex items-center gap-3">
                  <Play className="w-4 h-4 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
                  {tier}
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                  <Trophy className="w-3.5 h-3.5 text-yellow-500" />
                  Best: {leaderboard[tier] || 0}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2. ACTIVE GAMEPLAY SCREENS ('memorize' or 'reconstruct') */}
      {(gameState === 'memorize' || gameState === 'reconstruct') && (
        <div className="w-full flex flex-col items-center max-w-xl animate-in fade-in duration-200">
          {/* Header Dashboard HUD */}
          <div className="w-full max-w-[480px] flex items-center justify-between mb-4 bg-slate-900/80 backdrop-blur p-3 rounded-xl border border-slate-800">
            <div className="flex flex-col">
              <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">{difficulty}</span>
              <span className="text-xl font-extrabold text-amber-400">Score: {score}</span>
            </div>
            
            <div className="flex gap-1.5">
              {[...Array(3)].map((_, i) => (
                <Heart
                  key={i}
                  className={`w-6 h-6 transition-all duration-300 ${
                    i < lives ? 'text-red-500 fill-red-500 scale-100' : 'text-slate-600 fill-slate-800 scale-90'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Memorize Countdown Header */}
          {gameState === 'memorize' && (
            <div className="w-full max-w-[480px] mb-3 text-center">
              <div className="text-sm font-semibold text-amber-300 uppercase tracking-widest mb-1.5 animate-pulse">
                Memorize Board! Remaining: {countdown}s
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 transition-all duration-1000 ease-linear"
                  style={{ width: `${(countdown / 3) * 100}%` }}
                />
              </div>
            </div>
          )}

          {gameState === 'reconstruct' && (
            <div className="text-sm font-semibold text-emerald-400 uppercase tracking-widest mb-4">
              Rebuild the Position
            </div>
          )}

          {/* Chessboard Container */}
          <div ref={boardContainerRef} className="w-full max-w-[480px] aspect-square shadow-2xl rounded-lg overflow-hidden border-2 border-slate-800">
            <Chessboard
              position={gameState === 'memorize' ? targetFen : reconstructedPieces}
              boardWidth={boardWidth}
              arePiecesDraggable={gameState === 'reconstruct'}
              onPieceDrop={handlePieceDrop}
              onSquareClick={handleSquareClick}
              customBoardStyle={{
                borderRadius: '6px',
                boxShadow: '0 5px 15px rgba(0, 0, 0, 0.5)',
              }}
              customDarkSquareStyle={{ backgroundColor: '#475569' }}
              customLightSquareStyle={{ backgroundColor: '#cbd5e1' }}
            />
          </div>

          {/* Reconstruct Helper UI Tray */}
          {gameState === 'reconstruct' && <PieceBank />}

          {/* Dynamic Feedbacks Context Alerts */}
          {feedback.message && (
            <div className={`mt-4 p-3 rounded-xl border flex items-center gap-2.5 text-sm font-medium w-full max-w-[480px] ${
              feedback.type === 'success' 
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300' 
                : 'bg-red-950/80 border-red-500/50 text-red-300'
            }`}>
              {feedback.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* User Control Buttons */}
          {gameState === 'reconstruct' && (
            <div className="mt-4 flex gap-3 w-full max-w-[480px]">
              <button
                onClick={skipLevel}
                className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 text-sm"
              >
                Skip (-1 Life)
              </button>
              <button
                onClick={submitPosition}
                disabled={feedback.type === 'success'}
                className="flex-[2] py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 text-slate-950 rounded-xl font-bold transition-all shadow-lg shadow-amber-950/20 text-sm"
              >
                Submit Position
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. GAME OVER OVERLAY */}
      {gameState === 'gameover' && (
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-200">
          <div className="space-y-1">
            <div className="inline-flex p-3 bg-red-950/50 border border-red-900/50 text-red-400 rounded-full mb-2">
              <XCircle className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Game Over</h1>
            <p className="text-slate-400 text-sm">You lost your structural vision anchors.</p>
          </div>

          <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800 font-mono space-y-2">
            <div className="flex justify-between items-center text-sm text-slate-400">
              <span>Difficulty Tier:</span>
              <span className="text-slate-200 capitalize font-sans font-medium">{difficulty}</span>
            </div>
            <div className="flex justify-between items-center text-sm text-slate-400">
              <span>Final Score:</span>
              <span className="text-2xl font-black text-amber-400">{score}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-slate-500 border-t border-slate-800/80 pt-2 mt-2">
              <span>Personal Best:</span>
              <span>{leaderboard[difficulty] || 0} levels</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setGameState('start')}
              className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Home className="w-4 h-4" /> Menu
            </button>
            <button
              onClick={() => startGame(difficulty)}
              className="flex-[2] py-3 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <RotateCcw className="w-4 h-4" /> Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}