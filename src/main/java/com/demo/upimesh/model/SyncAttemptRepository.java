package com.demo.upimesh.model;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SyncAttemptRepository extends JpaRepository<SyncAttempt, Long> {
    List<SyncAttempt> findTop10ByOrderByAttemptedAtDesc();
}
