import React, { useState, useRef, useEffect } from 'react';
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
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery);
      setIsOpen(false);
      setSearchQuery('');
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
        setIsOpen(false);
        setSearchQuery('');
      }
    }
  };

  const toggleSearchBar = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchQuery('');
    }
  };

  // Cerrar la barra si se hace click fuera del componente
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Enfocar input al abrir la barra
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative w-full max-w-md mx-auto flex items-center">
      {/* Icono de búsqueda o de cierre */}
      <div
        onClick={toggleSearchBar}
        className="cursor-pointer p-2 select-none"
        aria-label={isOpen ? "Cerrar búsqueda" : "Abrir búsqueda"}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleSearchBar();
          }
        }}
      >
        {isOpen ? (
          <FaTimes className="text-gray-700" size={20} />
        ) : (
          <FaSearch className="text-gray-700" size={20} />
        )}
      </div>

      {/* Barra de búsqueda expandida con animación horizontal */}
      <form
        onSubmit={handleSubmit}
        className={`flex items-center ml-2 transition-all duration-300 ease-in-out overflow-hidden ${
          isOpen ? 'max-w-xl opacity-100 px-2 py-1 border border-gray-300 rounded-md shadow-md bg-white' : 'max-w-0 opacity-0 p-0 border-0 shadow-none bg-transparent'
        }`}
        aria-hidden={!isOpen}
        style={{ transitionProperty: 'max-width, opacity, padding, border, box-shadow, background-color' }}
      >
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-transparent focus:outline-none text-gray-800 placeholder-gray-400"
          aria-label="Buscar"
        />
        <button
          type="submit"
          className="ml-2 px-4 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Buscar
        </button>
      </form>
    </div>
  );
};

export default SearchBar;
