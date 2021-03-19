pragma solidity ^0.7.6;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "./IKlein.sol";

contract WrappedIKB is ERC721 {
  address public constant IKBAddress = 0x88AE96845e157558ef59e9Ff90E766E22E480390;
  IKlein public constant Klein = IKlein(IKBAddress);

  constructor() ERC721("WrappedIKB", "wIKB") {}

  function wrapAll() public returns (bool){
    uint256[] memory ownedRecords = Klein.getHolderEditions(msg.sender);
    uint ownedRecordsLength = ownedRecords.length;

    require(Klein.allowance(msg.sender,address(this)) >= ownedRecordsLength, "WrappedIKB: must approve all IKB tokens to be transfered");

    require(Klein.transferFrom(msg.sender,address(this), ownedRecordsLength), "WrappedIKB: IKB Token did not transferFrom");

    for (uint i = 0; i < ownedRecordsLength; i++){
      _safeMint(msg.sender, ownedRecords[i]);
    }

    return true;
  }

  function wrapSpecific(uint[] memory _editions) public returns (bool){
    uint editionsLen = _editions.length;
    for (uint i = 0; i < editionsLen; i++){
      require(Klein.specificTransferFrom(msg.sender, address(this), _editions[i]), "WrappedIKB: IKB Token did not specificTransferFrom");
      _safeMint(msg.sender, _editions[i]);
    }

    return true;
  }

}