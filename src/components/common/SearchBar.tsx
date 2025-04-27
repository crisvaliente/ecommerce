import React, { useState } from 'react';
import { FaSearch, FaTimes } from 'react-icons/fa';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ 
  onSearch, 
  placeholder = "Buscar productos..." 
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(false);

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

  const toggleSearchBar = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchQuery(''); // Limpiar la búsqueda cuando se expanda
    }
  };

  return (
    <div className="relative w-full max-w-sm mx-auto">
      {/* Icono de búsqueda o de cierre */}
      <div 
        onClick={toggleSearchBar} 
        className="cursor-pointer p-2"
      >
        {isOpen ? (
          <FaTimes className="text-gray-600" />
        ) : (
          <FaSearch className="text-gray-600" />
        )}
      </div>

      {/* Barra de búsqueda expandida */}
      {isOpen && (
        <form onSubmit={handleSubmit} className="flex mt-2">
          <input
            type="text"
            value={searchQuery}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100 text-gray-700 placeholder-gray-500 shadow-sm transition-all"
            aria-label="Buscar"
          />
          <button 
            type="submit" 
            className="ml-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Buscar
          </button>
        </form>
      )}
    </div>
  );
};

export default SearchBar;