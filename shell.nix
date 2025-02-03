{ pkgs ? import <nixpkgs> {} }:
pkgs.mkShell {
  name = "screeps";

  buildInputs = [
    pkgs.nodejs
    pkgs.yarn
  ];

  shellHook = ''
    export PATH=$(yarn bin):$PATH
  '';
}

