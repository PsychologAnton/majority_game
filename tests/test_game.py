import unittest
from server.game_engine import GameEngine

class TestGameEngine(unittest.TestCase):
    def test_initial_state(self):
        players = ["p1", "p2", "p3"]
        game = GameEngine(size=6, players=players)
        
        self.assertEqual(game.size, 6)
        self.assertEqual(len(game.players), 3)
        self.assertEqual(game.current_player_id, "p1")
        self.assertEqual(game.current_player_num, 1)
        self.assertEqual(game.board[0][0], 0)
        
    def test_simple_move(self):
        players = ["p1", "p2"]
        game = GameEngine(size=6, players=players)
        
        # P1 moves at 0,0
        res = game.make_move(0, 0, "p1")
        self.assertTrue(res["ok"])
        self.assertEqual(game.board[0][0], 1)
        self.assertEqual(game.current_player_id, "p2") # Turn changed

    def test_capture_mechanic(self):
        # Scenario: P1 has 2 pieces, P2 places 1 piece.
        # Check if P1 captures P2 or vice versa based on majority.
        # Usually: Place P2. Check neighbors. 
        # Neighbors of P2: P1(2). P1(2) > P2(1). 
        # P2 is NOT captured by P1 immediately upon placement?
        # WAIT. Majority rule: 
        # "A cell is captured if among its 8 neighbors, 'friendly' > 'enemy'."
        # Usually this check happens on EXISTING cells, triggered by a new placement.
        # If I place at (r,c), I am a new neighbor to 8 cells.
        # I check those 8 cells. If one of them is Enemy, I check ITs neighbors.
        # If I (Friendly to me) > Enemy (Friendly to him), I capture him.
        
        players = ["A", "B"]
        game = GameEngine(size=6, players=players)
        
        # Setup board manually for test
        # A A
        # B .
        #
        # If A places at (0,0) and (0,1).
        # B places at (1,0).
        # Neighbors of B(1,0) are A(0,0), A(0,1). 
        # Count for A = 2. Count for B = 1 (itself doesnt count).
        # So A > B. B should flip to A?
        # BUT B just placed it? Usually you don't commit suicide?
        # Or is the check: "When I place X, do I capture neighbors?"
        # Yes. I capture neighbors.
        # So if A places, A captures B.
        # If B places, B captures A? Only if B > A.
        
        # Let's test: B is at (1,0). A places at (0,0).
        # Neighbors of B(1,0): (0,0) which is A.
        # Count around B(1,0): A=1, B=0.
        # 1 > 0. So B should flip to A.
        
        # 1. B moves to (1,0)
        game.turn_idx = 1 # B's turn
        game.make_move(1, 0, "B") # Board[1][0] = 2
        
        # 2. A moves to (0,0)
        game.turn_idx = 0 # A's turn
        res = game.make_move(0, 0, "A") # Board[0][0] = 1
        
        # Check if (1,0) flipped to 1 (A)
        # Neighbors of (1,0) is (0,0)=A.
        # Around (1,0): A=1, B=0. 1 > 0. Flip!
        self.assertEqual(game.board[1][0], 1, "B should be captured by A")
        self.assertEqual(game.board[0][0], 1)
        self.assertIn((1,0), res["flips"])

    def test_three_players_capture(self):
        # A, B, C.
        # B is at (1,1).
        # A places at (0,1).
        # C places at (1,0).
        # A places at (1,2).
        # Now neighbors of B(1,1): A(0,1), C(1,0), A(1,2).
        # Count around B: A=2, C=1, B=0.
        # Attackers: A has 2. C has 1.
        # Does A capture B? Yes, A(2) > B(0).
        # Does C capture B? C(1) > B(0).
        # Who gets it? The one who triggered the check.
        # If A just placed (1,2), A triggers. A checks B. A(2) > B(0). A captures.
        
        players = ["A", "B", "C"]
        game = GameEngine(size=6, players=players)
        
        # 1. A moves (0,1)
        game.make_move(0, 1, "A")
        # 2. B moves (1,1)
        game.make_move(1, 1, "B")
        # 3. C moves (1,0)
        game.make_move(1, 0, "C")
        
        # Board:
        # . A .
        # C B .
        
        # Neighbors of B(1,1): A(0,1), C(1,0).
        # B is surrounded by 1 A and 1 C.
        # Neither flipped B yet because they placed BEFORE B or didn't have majority.
        # When C placed at (1,0):
        # Check B(1,1). Neighbors of B: A(1), C(1). B(0).
        # C(1) > B(0). So C should have captured B immediately!
        
        self.assertEqual(game.board[1][1], 3, "B should have been captured by C immediately upon C's move")

if __name__ == '__main__':
    unittest.main()
