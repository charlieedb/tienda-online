export type Category = {
  token: string;
  label: string;
  icon: "menu" | "wine" | "milk" | "bread" | "cart" | "sparkles" | "clean" | "beer" | "drink" | "meat";
};

export const CATEGORIES: Category[] = [
  { token: "vino", label: "Vino", icon: "wine" },
  { token: "cerveza", label: "Cerveza", icon: "beer" },
  { token: "gaseosa", label: "Gaseosas", icon: "drink" },
  { token: "lacteos", label: "Lácteos", icon: "milk" },
  { token: "pan", label: "Panadería", icon: "bread" },
  { token: "fiambre", label: "Fiambres", icon: "meat" },
  { token: "limpieza", label: "Limpieza", icon: "clean" },
];

