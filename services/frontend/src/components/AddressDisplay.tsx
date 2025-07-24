import React from 'react'

interface AddressDisplayProps {
  address: string
}

const AddressDisplay: React.FC<AddressDisplayProps> = ({ address }) => {
  const copyToClipboard = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      alert('Address copied to clipboard!')
    }
  }

  return (
    <div className="address-display">
      {address ? (
        <div className="address-content">
          <h3>Current Selected Address:</h3>
          <div className="address-value" onClick={copyToClipboard}>
            <span className="address-text">{address}</span>
            <button className="copy-btn" title="Copy to clipboard">
              📋
            </button>
          </div>
          <p className="address-note">
            Click the address to copy to clipboard
          </p>
        </div>
      ) : (
        <div className="no-address">
          <h3>No address selected</h3>
          <p>Connect a wallet or enter an address manually, then click "Select Current Address"</p>
        </div>
      )}
    </div>
  )
}

export default AddressDisplay 