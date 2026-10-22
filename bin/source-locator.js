// Older collectors put a line annotation after the file name. This resolves the
// locator only; it neither changes the source record nor verifies its claims.
function localSourceLocator(value) {
  return String(value).replace(/\s+\([^)]*(?:строк[аи]?|lines?)\s+\d[^)]*\)\s*$/i,'').split('#')[0].replace(/:\d+(?:-\d+)?$/,'')
}
module.exports={localSourceLocator}
