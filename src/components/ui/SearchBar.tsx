import React, { useState } from 'react';
import { FaSearch } from 'react-icons/fa';

interface SearchBarProps {
  onSearch: (searchTerm: string) => void;
  placeholder?: string;
}

const ProductSearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  placeholder = "Buscar productos..."
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchTerm);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSearch} className="relative">
        <input
          type="text"
          className="w-full px-4 py-2 pr-10 text-sm border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button
          type="submit"
          className="absolute right-0 top-0 mt-2 mr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
          aria-label="Buscar"
        >
          <FaSearch />
        </button>
      </form>
    </div>
  );
};

export default ProductSearchBar;
