const { assert } = require("chai");

let kleinContract
let kleinAddress = "0x88AE96845e157558ef59e9Ff90E766E22E480390"
let wrapperContract
let whaleOwnerAddress = "0x00d7e4903c6d88deeb29eecd9e7e853a31c46554"
let registryAddress = "0x0000000000000000000000000000000000000001"

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
  wrapperContract = await WrappedIKB.deploy(kleinAddress, registryAddress);
}

async function getDefaultProvider(){
  return (await getDefaultSigner()).provider
}

async function getDefaultSigner(){
  return (await ethers.getSigners())[0]
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
          assert(/owner query for nonexistent token/.test(e.message),`Incorrect error. Got ${e.message}`)
        }
      }

      assert.equal(toNumber(await wrapperContract.balanceOf(whaleOwnerAddress)), 0, 'Wrapper did not properly reset')

      try {
        await wrapperContract.connect(whaleOwner).wrapAll()
        throw new Error('Wrapper expected to throw before approval')
      } catch(e){
        assert(/must approve all IKB tokens to be transfered/.test(e.message),`Incorrect error. Got ${e.message}`)
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
      const specificEdition = allEditions[0]

      assert.equal(allEditions.length, 10, 'Test did not reset correctly')

      await kleinContract.connect(whaleOwner).specificApprove(wrapperContract.address, specificEdition)

      await wrapperContract.connect(whaleOwner).wrapSpecific(specificEdition)

      assert.equal(toNumber(await wrapperContract.balanceOf(whaleOwnerAddress)), 1, 'Wrapper did not mint correct number of tokens')

      assert.equal(toNumber(await kleinContract.balanceOf(whaleOwnerAddress)), allEditions.length-1, 'Klein did clear additions for record owner')

      assert.equal(toNumber(await kleinContract.balanceOf(wrapperContract.address)), 1, 'Klein did not assign all editions to wrapper contract')

      assert.equal((await wrapperContract.ownerOf(specificEdition)).toLowerCase(), whaleOwnerAddress.toLowerCase(), 'Wrapper did not mint correctly')

      assert.equal((await kleinContract.records(specificEdition)).addr.toLowerCase(), wrapperContract.address.toLowerCase(), 'Klein did not assign edition ownership to Wrapper')
    })
  })

  describe("unwrapAll", function(){
     it("should transfer back and burn all tokens", async function(){

       // Setup
       this.timeout(300000)

       const whaleOwner = await getSigner(whaleOwnerAddress)
       const editions = (await kleinContract.getHolderEditions(whaleOwnerAddress)).map(toNumber)

       assert.equal(editions.length, 10, 'Test did not reset correctly')

       await kleinContract.connect(whaleOwner).approve(wrapperContract.address, editions.length)

       await wrapperContract.connect(whaleOwner).wrapAll()

       assert.equal(toNumber(await kleinContract.balanceOf(wrapperContract.address)), editions.length, 'Klein did not assign all editions to wrapper contract')

       await wrapperContract.connect(whaleOwner).unwrapAll()

       // Tests

      assert.equal(toNumber(await wrapperContract.balanceOf(whaleOwnerAddress)), 0, 'Wrapper did not burn correct number of tokens')
      assert.equal(toNumber(await kleinContract.balanceOf(whaleOwnerAddress)), editions.length, 'Klein did clear additions for record owner')
      assert.equal(toNumber(await kleinContract.balanceOf(wrapperContract.address)), 0, 'Klein did not assign all editions away from wrapper contract')

      for (let edition of editions){
        try {
          await wrapperContract.ownerOf(editions)
          assert.fail('Wrapper contract did not burn correctly')
        } catch(e){
          assert(/owner query for nonexistent token/.test(e.message),`Incorrect error. Got ${e.message}`)
        }

        assert.equal((await kleinContract.records(edition)).addr.toLowerCase(), whaleOwnerAddress.toLowerCase(), 'Klein did not assign edition ownership to Wrapper')
      }

      })
  })

  describe("unwrapSpecific", function(){
     it("should transfer back and burn specific tokens after wrap all", async function(){

       // Setup
       this.timeout(300000)

       const whaleOwner = await getSigner(whaleOwnerAddress)
       const allEditions = (await kleinContract.getHolderEditions(whaleOwnerAddress)).map(toNumber)
       const specificEdition = allEditions[0]

       assert.equal(allEditions.length, 10, 'Test did not reset correctly')

       await kleinContract.connect(whaleOwner).approve(wrapperContract.address, allEditions.length)

       await wrapperContract.connect(whaleOwner).wrapAll()

       assert.equal(toNumber(await kleinContract.balanceOf(wrapperContract.address)), allEditions.length, 'Klein did not assign all editions to wrapper contract')

       await wrapperContract.connect(whaleOwner).unwrapSpecific(specificEdition)

        // Tests

        assert.equal(toNumber(await wrapperContract.balanceOf(whaleOwnerAddress)), allEditions.length - 1, 'Wrapper did not burn correct number of tokens')
        assert.equal(toNumber(await kleinContract.balanceOf(whaleOwnerAddress)), 1, 'Klein did clear additions for record owner')
        assert.equal(toNumber(await kleinContract.balanceOf(wrapperContract.address)), allEditions.length - 1, 'Klein did not assign all editions away from wrapper contract')

        try {
          await wrapperContract.ownerOf(specificEdition)
          assert.fail('Wrapper contract did not burn correctly')
        } catch(e){
          assert(/owner query for nonexistent token/.test(e.message),`Incorrect error. Got ${e.message}`)
        }

        assert.equal((await kleinContract.records(specificEdition)).addr.toLowerCase(), whaleOwnerAddress.toLowerCase(), 'Klein did not assign edition ownership to Wrapper')

     })
     it("should transfer back and burn specific tokens after wrap specific", async function(){

       // Setup
       this.timeout(300000)

       const whaleOwner = await getSigner(whaleOwnerAddress)
       const allEditions = (await kleinContract.getHolderEditions(whaleOwnerAddress)).map(toNumber)
       const specificEdition = allEditions[allEditions.length-1] // last one just to test

       assert.equal(allEditions.length, 10, 'Test did not reset correctly')

       await kleinContract.connect(whaleOwner).specificApprove(wrapperContract.address, specificEdition)

       await wrapperContract.connect(whaleOwner).wrapSpecific(specificEdition)

       assert.equal(toNumber(await kleinContract.balanceOf(wrapperContract.address)), 1, 'Klein did not assign all editions to wrapper contract')

       await wrapperContract.connect(whaleOwner).unwrapSpecific(specificEdition)


        // Tests

        assert.equal(toNumber(await wrapperContract.balanceOf(whaleOwnerAddress)), 0, 'Wrapper did not burn correct number of tokens')
        assert.equal(toNumber(await kleinContract.balanceOf(whaleOwnerAddress)), allEditions.length, 'Klein did clear additions for record owner')
        assert.equal(toNumber(await kleinContract.balanceOf(wrapperContract.address)), 0, 'Klein did not assign all editions away from wrapper contract')

        try {
          await wrapperContract.ownerOf(specificEdition)
          assert.fail('Wrapper contract did not burn correctly')
        } catch(e){
          assert(/owner query for nonexistent token/.test(e.message),`Incorrect error. Got ${e.message}`)
        }

        assert.equal((await kleinContract.records(specificEdition)).addr.toLowerCase(), whaleOwnerAddress.toLowerCase(), 'Klein did not assign edition ownership to Wrapper')

     })
  })

  describe("tokenURI", function(){
    describe('when tokenId is not minted', function(){
      it('should fail', async function(){
        try {
          await wrapperContract.tokenURI(0)
        } catch(e){
          assert(/URI query for nonexistent token/.test(e.message),`Incorrect error. Got ${e.message}`)
          return
        }
        assert.fail('Wrapper contract should have thrown')
      })
    })

    describe('when tokenId is minted', function(){
      it("should return the correct IPFS hash concatted with baseURI", async function(){
        // Setup
        this.timeout(300000)

        const whaleOwner = await getSigner(whaleOwnerAddress)
        const editions = (await kleinContract.getHolderEditions(whaleOwnerAddress)).map(toNumber)

        assert.equal(editions.length, 10, 'Test did not reset correctly')

        await kleinContract.connect(whaleOwner).approve(wrapperContract.address, editions.length)

        await wrapperContract.connect(whaleOwner).wrapAll()

        for (edition of editions){
          const regex = new RegExp(`${await wrapperContract.baseURI()}${await wrapperContract.tokenIPFSHash(edition)}`)
          const tokenURI = await wrapperContract.tokenURI(edition)
          assert(regex.test(tokenURI))
        }

      })
    })
  })
});