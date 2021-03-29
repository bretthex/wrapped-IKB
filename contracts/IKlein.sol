// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IKlein is IERC20 {

  function getHolderEditions(address _holder) external view returns (uint256[] memory);

  function specificTransferFrom(address _from, address _to, uint _edition) external returns (bool success);

  function specificTransfer(address _to, uint _edition) external returns (bool success);
}