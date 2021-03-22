pragma solidity ^0.7.6;

import "@openzeppelin/contracts/token/ERC721/ERC721Burnable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IKlein.sol";

contract OwnableDelegateProxy {}

contract ProxyRegistry {
    mapping(address => OwnableDelegateProxy) public proxies;
}

contract WrappedIKB is ERC721, ERC721Burnable, Ownable{
  address public constant IKBAddress = 0x88AE96845e157558ef59e9Ff90E766E22E480390;

  IKlein public constant Klein = IKlein(IKBAddress);

  address[] public proxyRegistryAddresses;

  constructor(address _openSeaProxyRegistryAddress)
    ERC721("WrappedIKB", "wIKB")
    Ownable()
    public
  {
    proxyRegistryAddresses.push(_openSeaProxyRegistryAddress);
  }

  /**
   * Override isApprovedForAll to whitelist proxy accounts to enable gas-less listings on Open Sea
   */
  function isApprovedForAll(address owner, address operator)
      public
      override
      view
      returns (bool)
  {
      uint proxyRegistryAddressesLen = proxyRegistryAddresses.length;
      for (uint i; i < proxyRegistryAddressesLen; i++){
        ProxyRegistry proxyRegistry = ProxyRegistry(proxyRegistryAddresses[i]);
        if (address(proxyRegistry.proxies(owner)) == operator) {
            return true;
        }
      }

      return super.isApprovedForAll(owner, operator);
  }

  function wrapAll() public returns (bool){
    uint256[] memory ownedRecords = Klein.getHolderEditions(_msgSender());
    uint ownedRecordsLength = ownedRecords.length;

    require(Klein.allowance(_msgSender(),address(this)) >= ownedRecordsLength, "WrappedIKB: must approve all IKB tokens to be transfered");

    require(Klein.transferFrom(_msgSender(),address(this), ownedRecordsLength), "WrappedIKB: IKB Token did not transferFrom");

    for (uint i = 0; i < ownedRecordsLength; i++){
      _safeMint(_msgSender(), ownedRecords[i]);
    }

    return true;
  }

  function wrapSpecific(uint[] memory _editions) public returns (bool){
    uint editionsLen = _editions.length;

    for (uint i = 0; i < editionsLen; i++){
      require(Klein.specificTransferFrom(_msgSender(), address(this), _editions[i]), "WrappedIKB: IKB Token did not specificTransferFrom");
      _safeMint(_msgSender(), _editions[i]);
    }

    return true;
  }

  function unwrapAll() public returns (bool){
    uint256 balance = balanceOf(_msgSender());

    uint[] memory tokenIds = new uint[](balance);

    for (uint256 i = 0; i < balance; i++){
      tokenIds[i] = (tokenOfOwnerByIndex(_msgSender(), i));
    }

    return unwrapSpecific(tokenIds);
  }


  function unwrapSpecific(uint[] memory _tokenIds) public returns (bool){
    uint256 tokenIdsLen = _tokenIds.length;

    for (uint256 i = 0; i < tokenIdsLen; i++){
      require(ownerOf(_tokenIds[i]) == _msgSender(), "WrappedIKB: Token not owned by sender");
      require(Klein.specificTransfer(_msgSender(), _tokenIds[i]), "WrappedIKB: Token transfer failed");
      burn(_tokenIds[i]);
    }

    return true;
  }

}