const path = require('path')
const loaderUtils = require('loader-utils')

module.exports = function (content) {
  if (this.cacheable) this.cacheable()

  let options = loaderUtils.getOptions(this) || {}
  let context = options.context || this.rootContext
  let done = this.async()

  const resolveLoaderAssets = resolveAssets.bind(this)
  const emitLoaderData = emitData.bind(this, options, context)

  let json = JSON.parse(content)
  let images = getImageAssets(json)
  let dataPath = emitLoaderData(json)

  Promise.all([
    resolveLoaderAssets(images)
  ]).then(([images]) => {
    let spriteOut = generateSprite(json, images, dataPath)
    done(null, spriteOut)
  }).catch((err) => {
    done(err)
  })
}

function getImageAssets (json) {
  let { textures } = json
  return textures.map(({ image }) => image)
}

function resolveAssets (assets) {
  if (!assets) return Promise.resolve([])
  let resourceDir = path.dirname(this.resource)
  return Promise.all(
    assets.map((uri) =>
      resolveDependency(this, resourceDir, `./${uri}`).then(() => uri)
    ))
}

function resolveDependency (loader, context, chunkPath) {
  return new Promise((resolve, reject) => {
    loader.resolve(context, chunkPath, (err, dependency) => {
      if (err) return reject(err)

      loader.addDependency(dependency)
      resolve(dependency)
    })
  })
}

// TODO: Maybe sort frames?
function emitData (options, context, json) {
  let content = JSON.stringify(json)

  let url = loaderUtils.interpolateName(
    this,
    options.name || '[contenthash].[ext]',
    {
      context,
      content,
      regExp: options.regExp,
    }
  )

  let outputPath = url
  let publicPath = `__webpack_public_path__ + ${JSON.stringify(outputPath)}`

  this.emitFile(outputPath, content)

  return publicPath
}

function generateSprite (json, images, dataPath) {
  let moduleSource = '/***** Sprite Module *****/\n'
  let spriteString = ''

  spriteString += `images:[`
  images.forEach((asset, i, arr) => {
    spriteString += `require('./${asset}')`
    if (i < arr.length - 1) spriteString += ','
  })
  spriteString += `],\n`

  spriteString += `dataPath:${dataPath}`

  moduleSource += `module.exports = {\n${spriteString}};\n`

  return moduleSource
}
