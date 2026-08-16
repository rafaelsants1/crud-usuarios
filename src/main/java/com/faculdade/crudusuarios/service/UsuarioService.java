package com.faculdade.crudusuarios.service;

import com.faculdade.crudusuarios.Usuario;
import com.faculdade.crudusuarios.exception.RecursoDuplicadoException;
import com.faculdade.crudusuarios.repository.UsuarioRepository;
import org.springframework.stereotype.Service;
import java.util.List;
@Service
public class UsuarioService {
    private final UsuarioRepository usuarioRepository;

    public UsuarioService(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    public List<Usuario> listarTodos() {
        return usuarioRepository.findAll();
    }

    public Usuario cadastrar(Usuario usuario) {
        if (usuarioRepository.existsByCpf(usuario.getCpf())) {
            throw new RecursoDuplicadoException("Já existe um usuário cadastrado com o CPF " + usuario.getCpf());
        }
        if (usuarioRepository.existsByEmail(usuario.getEmail())) {
            throw new RecursoDuplicadoException("Já existe um usuário cadastrado com o E-mail " + usuario.getEmail());
        }
        return usuarioRepository.save(usuario);
    }
}
