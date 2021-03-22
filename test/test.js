const { assert } = require("chai");

let kleinContract
let wrapperContract
let whaleOwnerAddress = "0x00d7e4903c6d88deeb29eecd9e7e853a31c46554"
async function impersonate(address){
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address]}
  )
}

async function stopImpersonate(address){
  await hre.network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [address]}
  )
}

async function reset(){
  await network.provider.request({
    method: "hardhat_reset",
    params: [{
      forking: {
        jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
        blockNumber: 12063200
      }
    }]
  })
}

async function getwhaleOwner(edition){
  return (await kleinContract.records(edition)).addr
}

async function attachKlein(){
  const kleinContractAddress = "0x88AE96845e157558ef59e9Ff90E766E22E480390"
  const kleinArtifact = await artifacts.readArtifact("Klein");
  const Klein = new ethers.Contract(kleinContractAddress, kleinArtifact.abi, await getDefaultProvider());
  kleinContract = Klein.attach(kleinContractAddress)
}

async function deployWrapper(){
  const WrappedIKB = await ethers.getContractFactory("WrappedIKB");
  wrapperContract = await WrappedIKB.deploy();
}

async function getDefaultProvider(){
  return (await ethers.getSigners())[0].provider
}

async function getSigner(address){
  const balance = await hre.ethers.provider.getBalance(address)

  const oneEth = hre.ethers.utils.parseEther("1")

  if (balance.lt(oneEth)){
    await (await ethers.getSigners())[0].sendTransaction({
      to: address,
      value: ethers.utils.parseEther("2")
    })
  }

  return await hre.ethers.provider.getSigner(address)
}

function toNumber(BN){
  return BN.toNumber()
}

beforeEach(function(done){
  reset()
  .then(attachKlein)
  .then(deployWrapper)
  .then(()=>impersonate(whaleOwnerAddress)).then(done)
})


describe("IKB Wrapper", function() {
  describe("wrapAll", function(){
    it("should mint new NFTs for each owned record if all approved", async function() {
      this.timeout(300000)
      const whaleOwner = await getSigner(whaleOwnerAddress)
      const editions = (await kleinContract.getHolderEditions(whaleOwnerAddress)).map(toNumber)
      assert.equal(editions.length, 10, 'Test did not reset correctly')

      // Wrapper does not have minted editions
      for (let edition of editions){
        try {
          await wrapperContract.ownerOf(edition)
          throw new Error(`Wrapper has edition ${edition} minted`)
        } catch(e){
          assert.isDefined(e)
        }
      }

      assert.equal(toNumber(await wrapperContract.balanceOf(whaleOwnerAddress)), 0, 'Wrapper did not properly reset')

      try {
        await wrapperContract.connect(whaleOwner).wrapAll()
        throw new Error('Wrapper expected to throw before approval')
      } catch(e){
        assert.isDefined(e)
      }

      await kleinContract.connect(whaleOwner).approve(wrapperContract.address, editions.length)
      await wrapperContract.connect(whaleOwner).wrapAll()

      assert.equal(toNumber(await wrapperContract.balanceOf(whaleOwnerAddress)), editions.length, 'Wrapper did not mint correct number of tokens')
      assert.equal(toNumber(await kleinContract.balanceOf(whaleOwnerAddress)), 0, 'Klein did clear additions for record owner')
      assert.equal(toNumber(await kleinContract.balanceOf(wrapperContract.address)), editions.length, 'Klein did not assign all editions to wrapper contract')

      for (let edition of editions){
        assert.equal((await wrapperContract.ownerOf(editions[0])).toLowerCase(), whaleOwnerAddress.toLowerCase(), 'Wrapper did not mint correctly')
        assert.equal((await kleinContract.records(edition)).addr.toLowerCase(), wrapperContract.address.toLowerCase(), 'Klein did not assign edition ownership to Wrapper')
      }
    });
  })

  describe("wrapSpecific", function(){
    it("should mint specific approved NFTS", async function(){
      this.timeout(300000)
      const whaleOwner = await getSigner(whaleOwnerAddress)

      const allEditions = (await kleinContract.getHolderEditions(whaleOwnerAddress)).map(toNumber)
      const specificEditions = [allEditions[0], allEditions[1]]

      assert.equal(allEditions.length, 10, 'Test did not reset correctly')

      for (let edition of specificEditions){
        await kleinContract.connect(whaleOwner).specificApprove(wrapperContract.address, edition)

      }
      const c = wrapperContract.connect(whaleOwner)
      await c.wrapSpecific(specificEditions)

      assert.equal(toNumber(await wrapperContract.balanceOf(whaleOwnerAddress)), specificEditions.length, 'Wrapper did not mint correct number of tokens')

      assert.equal(toNumber(await kleinContract.balanceOf(whaleOwnerAddress)), allEditions.length-specificEditions.length, 'Klein did clear additions for record owner')

      assert.equal(toNumber(await kleinContract.balanceOf(wrapperContract.address)), specificEditions.length, 'Klein did not assign all editions to wrapper contract')

      for (let edition of specificEditions){
        assert.equal((await wrapperContract.ownerOf(edition)).toLowerCase(), whaleOwnerAddress.toLowerCase(), 'Wrapper did not mint correctly')
        assert.equal((await kleinContract.records(edition)).addr.toLowerCase(), wrapperContract.address.toLowerCase(), 'Klein did not assign edition ownership to Wrapper')
      }

      // Sanity Check
      assert.equal((await kleinContract.records(allEditions[specificEditions.length])).addr.toLowerCase(), whaleOwnerAddress.toLowerCase(), 'Klein wrapped an incorrect edition')
    })
  })
});