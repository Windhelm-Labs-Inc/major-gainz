import React, { useState } from 'react'

interface AddressInputProps {
  onAddressChange: (address: string) => void
  address: string
}

const AddressInput: React.FC<AddressInputProps> = ({ onAddressChange, address }) => {
  const [inputValue, setInputValue] = useState(address)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    onAddressChange(value)
  }

  const isValidHbarAddress = (addr: string): boolean => {
    // Basic HBAR address validation (format: 0.0.xxxxx)
    const hbarPattern = /^0\.0\.\d+$/
    return hbarPattern.test(addr) || addr.startsWith('0x') // Also allow Ethereum addresses
  }

  return (
    <div className="address-input">
      <label htmlFor="hbar-address">
        <h3>Manual HBAR Address Input</h3>
      </label>
      <input
        id="hbar-address"
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder="Enter HBAR address (e.g., 0.0.12345) or Ethereum address"
        className={`address-field ${
          inputValue && !isValidHbarAddress(inputValue) ? 'invalid' : ''
        }`}
      />
      {inputValue && !isValidHbarAddress(inputValue) && (
        <p className="error-message">
          Please enter a valid HBAR address (0.0.xxxxx) or Ethereum address (0x...)
        </p>
      )}
    </div>
  )
}

export default AddressInput 