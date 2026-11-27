import logoDark from "../assets/img/logodark.png";
import logoWhite from "../assets/img/logowhite.png";

interface BrandLogoProps {
  className?: string;
  alt?: string;
}

export default function BrandLogo({
  className = "",
  alt = "EscalaFácil",
}: BrandLogoProps) {
  return (
    <span className={`brand-logo flex items-center ${className}`}>
      <img
        src={logoDark}
        alt={alt}
        className="brand-logo-light block h-full w-full object-contain"
      />
      <img
        src={logoWhite}
        alt=""
        aria-hidden="true"
        className="brand-logo-dark hidden h-full w-full object-contain"
      />
    </span>
  );
}
