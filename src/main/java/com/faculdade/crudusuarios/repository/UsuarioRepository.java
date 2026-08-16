package com.faculdade.crudusuarios.repository;
import com.faculdade.crudusuarios.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UsuarioRepository extends JpaRepository <Usuario, Long> {
    boolean existsByCpf(String cpf);
    boolean existsByEmail(String email);

    List<Usuario> cpf(String cpf);
}
