// SPDX-License-Identifier: MIT
/**
 * @dev Stripped out ProxyRegistry from Open Sea's ERC721Tradable
 * https://raw.githubusercontent.com/ProjectOpenSea/opensea-creatures/0ac530b8a05b605c3376c0e026399b575ade0499/contracts/ERC721Tradable.sol
*/

contract OwnableDelegateProxy {}

contract ProxyRegistry {
  mapping(address => OwnableDelegateProxy) public proxies;
}