pragma solidity ^0.7.6;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC721/ERC721Burnable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IKlein.sol";

contract OwnableDelegateProxy {}

contract ProxyRegistry {
    mapping(address => OwnableDelegateProxy) public proxies;
}

contract WrappedIKB is ERC721, ERC721Burnable, Ownable {
  mapping (uint256 => string) private _tokenURIs;

  string private _baseURI;

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
   * Override isApprovedForAll to whitelist proxy accounts to enable gas-less listings on Open Sea and other NFT platforms
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

  function wrapSpecific(uint[] memory editions) public returns (bool){
    for (uint i = 0; i < editions.length; i++){
      require(Klein.specificTransferFrom(_msgSender(), address(this), editions[i]), "WrappedIKB: IKB Token did not specificTransferFrom");
      _safeMint(_msgSender(), editions[i]);
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


  function unwrapSpecific(uint[] memory tokenIds) public returns (bool){
    for (uint256 i = 0; i < tokenIds.length; i++){
      require(ownerOf(tokenIds[i]) == _msgSender(), "WrappedIKB: Token not owned by sender");
      require(Klein.specificTransfer(_msgSender(), tokenIds[i]), "WrappedIKB: Token transfer failed");
      burn(tokenIds[i]);
    }

    return true;
  }

  function _setTokenURI(uint256 tokenId, string memory _tokenURI) internal override {
      _tokenURIs[tokenId] = _tokenURI;
  }

  function setTokenUri(uint256 tokenId, string memory tokenURI)
    public
    onlyOwner
    returns (bool)
  {
    require(bytes(_tokenURIs[tokenId]).length == 0, 'WrappedIKB: tokenUri has already been set');

    require(tokenId == 0 || bytes(_tokenURIs[tokenId-1]).length > 0, 'WrappedIKB: tokenUri must be set sequentially');

    _setTokenURI(tokenId, tokenURI);

    return true;
  }

  function setTokenURIs(uint[] memory tokenIds, string[] memory tokenURIs)
    public
    onlyOwner
    returns (bool)
  {
    require(tokenIds.length == tokenURIs.length, 'WrappedIKB: tokenIds and tokenURIs must be the same length');

    for (uint256 i; i < tokenIds.length; i++){
      setTokenUri(tokenIds[i], tokenURIs[i]);
    }

    return true;
  }

  function revealTokenUri(uint256 tokenId) public view onlyOwner returns(string memory tokenUri){
    return _tokenURIs[tokenId];
  }

}