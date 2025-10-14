export const Toolbox = ({
  children,
  position: { left, top, right, bottom },
}: {
  children: React.ReactNode;
  position: { left?: number | string; top?: number | string; right?: number | string; bottom?: number | string };
}) => {
  return (
    <div className="absolute" style={{ zIndex: 1000, left, top, right, bottom }}>
      {children}
    </div>
  );
};

export default Toolbox;
