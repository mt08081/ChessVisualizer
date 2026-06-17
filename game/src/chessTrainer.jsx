import React, { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { Heart, Home, RotateCcw, Play, CheckCircle, XCircle, Eraser, Trash2 } from 'lucide-react';

// --- FIXED TEST POSITION ---
// White: King on e1, Rook on c1, Pawn on e2. 
// Black: King on e5, Queen on d6.
const FIXED_FEN = '8/8/3q4/4k3/8/8/4P3/2R1K3 w - - 0 1';

// --- RELIABLE CHESS.COM GRAPHICS ---
const PIECE_IMAGES = {
  wK: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wk.png',
  wQ: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wq.png',
  wR: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wr.png',
  wB: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wb.png',
  wN: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wn.png',
  wP: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/wp.png',
  bK: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bk.png',
  bQ: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bq.png',
  bR: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/br.png',
  bB: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bb.png',
  bN: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bn.png',
  bP: 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150/bp.png',
};

const PIECES = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];

export default function ChessVisionTrainer() {
  const [gameState, setGameState] = useState('start');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  
  const [reconstructedPieces, setReconstructedPieces] = useState({}); 
  const [feedback, setFeedback] = useState({ type: '', message: '' }); 
  const [countdown, setCountdown] = useState(3);
  const [activeTool, setActiveTool] = useState('wK'); 
  
  const timerRef = useRef(null);

  // --- GAME LOOP ---
  const startGame = () => {
    setScore(0);
    setLives(3);
    setFeedback({ type: '', message: '' });
    startLevel();
  };

  const startLevel = () => {
    setFeedback({ type: '', message: '' });
    setReconstructedPieces({});
    setActiveTool('wK');
    setGameState('memorize');
    setCountdown(3);

    if (timerRef.current) clearInterval(timerRef.current);
    
    // 3 Second Countdown
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

  // --- CRITICAL FIX: EXACTLY HOW REACT-CHESSBOARD CLEARS PIECES ---
  const getBoardPosition = () => {
    if (gameState === 'memorize') return FIXED_FEN;
    // If the object is empty, we MUST pass the string "empty" or it defaults to the start position!
    if (Object.keys(reconstructedPieces).length === 0) return "empty";
    return reconstructedPieces;
  };

  // --- PAINTBRUSH LOGIC ---
  const handleSquareClick = (square) => {
    if (gameState !== 'reconstruct') return;
    
    const updated = { ...reconstructedPieces };
    if (activeTool === 'eraser') {
      delete updated[square];
    } else {
      updated[square] = activeTool;
    }
    setReconstructedPieces(updated);
  };

  const handlePieceDrop = (sourceSquare, targetSquare, piece) => {
    if (gameState !== 'reconstruct') return false;
    const updated = { ...reconstructedPieces };
    delete updated[sourceSquare];
    if (targetSquare) {
      updated[targetSquare] = piece;
    }
    setReconstructedPieces(updated);
    return true;
  };

  // --- VALIDATION ---
  const submitPosition = () => {
    const targetChess = new Chess(FIXED_FEN);
    let isCorrect = true;
    let targetPieceCount = 0;
    const columns = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    // Strict piece-by-piece check
    for (let r = 1; r <= 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = `${columns[c]}${r}`;
        const targetP = targetChess.get(sq);
        const userPStr = reconstructedPieces[sq]; 

        if (targetP) targetPieceCount++;
        if (!targetP && !userPStr) continue;

        if (targetP && userPStr) {
          const expectedStr = `${targetP.color}${targetP.type.toUpperCase()}`;
          if (expectedStr !== userPStr) {
            isCorrect = false;
            break;
          }
        } else {
          isCorrect = false;
          break;
        }
      }
      if (!isCorrect) break;
    }

    if (isCorrect && Object.keys(reconstructedPieces).length === targetPieceCount) {
      setFeedback({ type: 'success', message: 'Perfect match! Reloading...' });
      setScore(prev => prev + 1);
      setTimeout(() => { startLevel(); }, 1500);
    } else {
      const remainingLives = lives - 1;
      setLives(remainingLives);
      
      if (remainingLives <= 0) {
        setFeedback({ type: 'error', message: 'Incorrect position!' });
        setTimeout(() => { setGameState('gameover'); }, 1500);
      } else {
        setFeedback({ type: 'error', message: `Wrong! Lost 1 life (${remainingLives} left).` });
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 antialiased font-sans">
      
      {/* 1. START SCREEN */}
      {gameState === 'start' && (
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-amber-400 mb-6">
            Prototype Test
          </h1>
          <button
            onClick={startGame}
            className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-bold text-lg flex justify-center items-center gap-2"
          >
            <Play className="w-5 h-5" /> Start Fixed Level
          </button>
        </div>
      )}

      {/* 2. GAME SCREEN */}
      {(gameState === 'memorize' || gameState === 'reconstruct') && (
        <div className="w-full flex flex-col items-center max-w-xl">
          
          <div className="w-full max-w-[480px] flex items-center justify-between mb-4 bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-lg">
            <div className="flex flex-col">
              <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Fixed Mode</span>
              <span className="text-2xl font-extrabold text-amber-400 leading-none">Score: {score}</span>
            </div>
            <div className="flex gap-2">
              {[...Array(3)].map((_, i) => (
                <Heart key={i} className={`w-7 h-7 transition-all ${i < lives ? 'text-red-500 fill-red-500' : 'text-slate-700 fill-slate-800'}`} />
              ))}
            </div>
          </div>

          {gameState === 'memorize' && (
            <div className="w-full max-w-[480px] mb-4 text-center bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl">
              <div className="text-base font-bold text-amber-400 uppercase tracking-widest mb-2 animate-pulse">
                Memorize Board!
              </div>
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 transition-all duration-1000 ease-linear" style={{ width: `${(countdown / 3) * 100}%` }} />
              </div>
            </div>
          )}

          {gameState === 'reconstruct' && (
             <div className="w-full max-w-[480px] flex justify-between items-center mb-4">
               <div className="text-sm font-semibold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-4 py-1.5 rounded-full">
                 Rebuild Position
               </div>
               <button onClick={() => setReconstructedPieces({})} className="text-xs font-semibold text-slate-400 hover:text-red-400 flex items-center gap-1">
                 <Trash2 className="w-4 h-4"/> Clear Board
               </button>
             </div>
          )}

          {/* CHESSBOARD */}
          <div className="w-full max-w-[480px] aspect-square shadow-2xl rounded-lg overflow-hidden border-4 border-slate-800">
            <Chessboard
              position={getBoardPosition()}
              boardWidth={480}
              arePiecesDraggable={gameState === 'reconstruct'}
              onPieceDrop={handlePieceDrop}
              onSquareClick={handleSquareClick}
              customDarkSquareStyle={{ backgroundColor: '#475569' }}
              customLightSquareStyle={{ backgroundColor: '#cbd5e1' }}
              animationDuration={0} // Prevents ghost pieces when wiping the board
            />
          </div>

          {/* TOOL TRAY */}
          {gameState === 'reconstruct' && (
            <div className="mt-4 p-4 bg-slate-800 rounded-xl border border-slate-700 w-full max-w-[480px] shadow-lg">
              <p className="text-xs text-slate-400 mb-3 text-center font-medium uppercase tracking-wider">
                Select a tool, then click the board to place or erase
              </p>
              
              <div className="flex flex-wrap justify-center gap-2">
                {PIECES.map((piece) => (
                  <button
                    key={piece}
                    onClick={() => setActiveTool(piece)}
                    className={`w-12 h-12 p-1.5 rounded-lg flex items-center justify-center transition-all ${
                      activeTool === piece ? 'bg-amber-500/20 border-2 border-amber-400 scale-110 shadow-lg' : 'bg-slate-900 border border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    <img src={PIECE_IMAGES[piece]} alt={piece} className="w-full h-full drop-shadow-md" draggable="false" />
                  </button>
                ))}
                
                <button
                  onClick={() => setActiveTool('eraser')}
                  className={`w-12 h-12 p-1.5 rounded-lg flex items-center justify-center transition-all ml-2 ${
                    activeTool === 'eraser' ? 'bg-red-500/20 border-2 border-red-400 scale-110 shadow-lg' : 'bg-slate-900 border border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <Eraser className={`w-7 h-7 ${activeTool === 'eraser' ? 'text-red-400' : 'text-slate-400'}`} />
                </button>
              </div>
            </div>
          )}

          {feedback.message && (
            <div className={`mt-4 p-4 rounded-xl border flex items-center gap-3 font-medium w-full max-w-[480px] shadow-lg ${
              feedback.type === 'success' ? 'bg-emerald-950 border-emerald-500 text-emerald-300' : 'bg-red-950 border-red-500 text-red-300'
            }`}>
              {feedback.type === 'success' ? <CheckCircle className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
              <span>{feedback.message}</span>
            </div>
          )}

          {gameState === 'reconstruct' && (
            <div className="mt-4 flex gap-3 w-full max-w-[480px]">
              <button
                onClick={() => {
                  const remainingLives = lives - 1;
                  setLives(remainingLives);
                  remainingLives <= 0 ? setGameState('gameover') : startLevel();
                }}
                className="flex-1 py-4 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-xl font-semibold transition-colors"
              >
                Skip (-1)
              </button>
              <button
                onClick={submitPosition}
                disabled={feedback.type === 'success'}
                className="flex-[2] py-4 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 rounded-xl font-bold text-lg transition-all"
              >
                Submit Position
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. GAME OVER OVERLAY */}
      {gameState === 'gameover' && (
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold text-slate-100">Game Over</h1>
            <p className="text-slate-400">Final Score: <span className="text-amber-400 font-bold">{score}</span></p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setGameState('start')} className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold flex items-center justify-center gap-2">
              <Home className="w-5 h-5" /> Menu
            </button>
            <button onClick={startGame} className="flex-[2] py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-bold flex items-center justify-center gap-2">
              <RotateCcw className="w-5 h-5" /> Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}