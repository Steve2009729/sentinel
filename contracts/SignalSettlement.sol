// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SignalSettlement
 * @notice HSP-inspired pay-per-signal settlement + decision log on HashKey Chain.
 * An AI agent pays a micro-fee to "unlock" a market signal. Each payment and each
 * resulting decision is recorded immutably. Mirrors the HSP model:
 * mandate (the pay call) -> settlement (native transfer) -> receipt (event) -> verifiable log.
 */
contract SignalSettlement {
    address public owner;
    uint256 public signalFee;        // fee per signal in wei
    uint256 public totalSignalsPaid;
    uint256 public totalDecisions;

    struct Receipt {
        uint256 id;
        address payer;
        string  tokenSymbol;     // the token the signal is about
        uint256 amountPaid;
        uint256 timestamp;
    }

    struct Decision {
        uint256 id;
        string  tokenSymbol;
        uint256 score;           // 0-100 agent confidence
        string  action;          // "ENTER", "WATCH", "SKIP"
        string  reasoning;       // plain-English why
        uint256 timestamp;
    }

    mapping(uint256 => Receipt) public receipts;
    mapping(uint256 => Decision) public decisions;

    event SignalPaid(uint256 indexed id, address indexed payer, string tokenSymbol, uint256 amount, uint256 timestamp);
    event DecisionLogged(uint256 indexed id, string tokenSymbol, uint256 score, string action, string reasoning, uint256 timestamp);
    event FeeUpdated(uint256 newFee);

    constructor(uint256 _signalFee) {
        owner = msg.sender;
        signalFee = _signalFee;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    /// @notice Agent calls this and pays the fee to unlock/consume a signal.
    function payForSignal(string calldata tokenSymbol) external payable returns (uint256) {
        require(msg.value >= signalFee, "insufficient fee");
        uint256 id = ++totalSignalsPaid;
        receipts[id] = Receipt(id, msg.sender, tokenSymbol, msg.value, block.timestamp);
        emit SignalPaid(id, msg.sender, tokenSymbol, msg.value, block.timestamp);
        return id;
    }

    /// @notice Agent records the decision it made after consuming a signal.
    function logDecision(
        string calldata tokenSymbol,
        uint256 score,
        string calldata action,
        string calldata reasoning
    ) external returns (uint256) {
        uint256 id = ++totalDecisions;
        decisions[id] = Decision(id, tokenSymbol, score, action, reasoning, block.timestamp);
        emit DecisionLogged(id, tokenSymbol, score, action, reasoning, block.timestamp);
        return id;
    }

    function setFee(uint256 _fee) external onlyOwner {
        signalFee = _fee;
        emit FeeUpdated(_fee);
    }

    function withdraw() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    function getReceipt(uint256 id) external view returns (Receipt memory) {
        return receipts[id];
    }

    function getDecision(uint256 id) external view returns (Decision memory) {
        return decisions[id];
    }
}
