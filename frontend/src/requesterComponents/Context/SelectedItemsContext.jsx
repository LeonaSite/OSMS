import { createContext, useContext, useState, useEffect } from "react";

const SelectedItemsContext = createContext();

export const SelectedItemsProvider = ({ children }) => {
  const [selectedItems, setSelectedItems] = useState(() => {
    //  LOAD from localStorage on first render
    const saved = localStorage.getItem("selectedItems");
    return saved ? JSON.parse(saved) : [];
  });

  //  SAVE to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("selectedItems", JSON.stringify(selectedItems));
  }, [selectedItems]);

  return (
    <SelectedItemsContext.Provider value={{ selectedItems, setSelectedItems }}>
      {children}
    </SelectedItemsContext.Provider>
  );
};

//  custom hook
export const useSelectedItems = () => {
  return useContext(SelectedItemsContext);
};
