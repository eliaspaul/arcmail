// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ArcMail {

    struct Message {
        address sender;
        address receiver;
        string  ipfsHash;
        uint256 timestamp;
    }

    Message[] public messages;
    mapping(address => string) public aliases;
    mapping(address => uint256[]) private inboxIndex;

    event MessageSent(
        address indexed sender,
        address indexed receiver,
        string  ipfsHash,
        uint256 timestamp
    );

    event AliasSet(address indexed wallet, string name);

    function sendMessage(
        address _receiver,
        string memory _ipfsHash
    ) public {
        require(_receiver != address(0), "Invalid receiver");
        require(bytes(_ipfsHash).length > 0, "Empty IPFS hash");

        uint256 idx = messages.length;
        messages.push(Message(msg.sender, _receiver, _ipfsHash, block.timestamp));
        inboxIndex[_receiver].push(idx);

        emit MessageSent(msg.sender, _receiver, _ipfsHash, block.timestamp);
    }

    function setAlias(string memory _name) public {
        require(bytes(_name).length > 0, "Empty alias");
        aliases[msg.sender] = _name;
        emit AliasSet(msg.sender, _name);
    }

    function totalMessages() public view returns (uint256) {
        return messages.length;
    }

    function getInbox(address _wallet) public view returns (uint256[] memory) {
        return inboxIndex[_wallet];
    }

    function getMessage(uint256 _index) public view returns (
        address sender,
        address receiver,
        string memory ipfsHash,
        uint256 timestamp
    ) {
        require(_index < messages.length, "Index out of range");
        Message memory m = messages[_index];
        return (m.sender, m.receiver, m.ipfsHash, m.timestamp);
    }
}