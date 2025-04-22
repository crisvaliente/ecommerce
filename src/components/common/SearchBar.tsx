import React, { useState } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ 
  onSearch, 
  placeholder = "Buscar productos..." 
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchQuery.trim()) {
        onSearch(searchQuery);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full flex">
      <input
        type="text"
        value={searchQuery}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-4 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-1 focus:ring-gray-400 bg-gray-100 text-black"
        aria-label="Buscar"
      />
      <button 
        type="submit" 
        className="bg-gray-800 text-white px-4 py-2 rounded-r-md hover:bg-gray-700 transition-colors"
      >
        Buscar
      </button>
    </form>
  );
};

export default SearchBar;
