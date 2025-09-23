export const Toolbox = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="absolute" style={{ zIndex: 1000, left: '10px', top: '10px' }}>
      {children}
    </div>
  );
};

export default Toolbox;
